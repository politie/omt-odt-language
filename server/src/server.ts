import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    InitializeResult,
    DocumentLinkParams,
    DocumentLink,
    DefinitionParams,
    Location,
    Range,
} from 'vscode-languageserver/node';
import {
    Position,
    TextDocument
} from 'vscode-languageserver-textdocument';
import OmtDocumentInformationProvider, { getImportsFromDocument } from './omtDocumentInformationProvider';
import { WorkspaceLookup } from './workspaceLookup';
import * as fs from "fs";
import { OmtDocumentInformation, OmtLocalObject } from './types';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);
const documentResults: Map<string, OmtDocumentInformation> = new Map();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDocumentLinkCapabilities = false;
let omtDocumentInformationProvider: OmtDocumentInformationProvider;
let workspaceLookup: WorkspaceLookup;

// tell the client what functionality is supported in this LSP when it initializes.
connection.onInitialize((params: InitializeParams) => {
    shutdownCheck();
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!capabilities.workspace?.configuration;
    hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
    hasDocumentLinkCapabilities = !!capabilities.textDocument?.documentLink;

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            definitionProvider: true,
            documentLinkProvider: { resolveProvider: true },
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

// really start all functionality, like watching the workspace, after the client has initialized.
connection.onInitialized(() => {
    shutdownCheck();
    workspaceLookup = new WorkspaceLookup(connection.workspace);
    omtDocumentInformationProvider = new OmtDocumentInformationProvider(workspaceLookup);
    workspaceLookup.init().then(() => {
        workspaceLookup.scanAll();
    });

    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasDocumentLinkCapabilities) {
        connection.onDocumentLinks(documentLinksHandler);
        connection.onDocumentLinkResolve(documentLinkResolve);
    }
});

function comparePositions(pos1: Position, pos2: Position) {
    if (pos1.line !== pos2.line) {
        return pos1.line > pos2.line ? 1 : -1;
    }
    if (pos1.character !== pos2.character) {
        return pos1.character > pos2.character ? 1 : -1;
    }
    return 0;
}

function positionInRange(position: Position, range: Range) {
    return comparePositions(range.start, position) <= 0 && comparePositions(position, range.end) <= 0;
}



connection.onDefinition((params) => {
    const locations: Location[] = [];
    const document = documents.get(params.textDocument.uri);
    if (document) {
        const links = getOmtDocumentResult(document);

        links.calledObjects.forEach(link => {
            if (positionInRange(params.position, link.range)) {
                locations.push(...getLocationsForLink(params, links, link));
            }
        });
    }

    return locations;
});

function getLocationsForLink(params: DefinitionParams, links: OmtDocumentInformation, link: OmtLocalObject): Location[] {
    const locations: Location[] = []
    links.definedObjects.filter(x => x.name === link.name).forEach(t => {
        locations.push(Location.create(params.textDocument.uri, t.range));
    });
    links.availableImports.filter(x => x.name === link.name).forEach(i => {
        const linkUrl = `${i.fullUrl}`;

        const otherDocument = TextDocument.create(linkUrl, 'omt', 1, fs.readFileSync(linkUrl).toString());
        if (otherDocument) {
            const result = getImportsFromDocument(otherDocument);
            const definedObject = result.localDefinedObject.find(x => x.name == link.name);
            if (definedObject) {
                locations.push(Location.create(i.fullUrl, definedObject.range));
            }
        }
    });
    return locations;
}

/**
 * shutdown protocol
 * The protocol can be found here: https://microsoft.github.io/language-server-protocol/specification#shutdown
 * It states that after this request has been received all other requests should return an error response
 * except for the exit notification. That should return an error when it has not been called.
 */
let isShuttingDown = false;
connection.onShutdown(() => {
    shutdownCheck();
    isShuttingDown = true;
    connection.dispose();
});

/**
 * throws an error when the server is shutting down.
 */
function shutdownCheck() {
    if (isShuttingDown) {
        throw new Error('LSP server is shutting down');
    }
}

// called after `onShutdown`
connection.onExit(() => {
    if (!isShuttingDown) {
        throw new Error('LSP server is not shutting down');
    }
    process.exit();
});

let timerId: NodeJS.Timeout;
let currentChangingDocumentUri: string;

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    shutdownCheck();
    if (currentChangingDocumentUri === change.document.uri) {
        timerId && clearTimeout(timerId);
    }
    timerId = setTimeout(() => documentResults.set(change.document.uri, omtDocumentInformationProvider.provideDocumentInformation(change.document)), 1000);
    currentChangingDocumentUri = change.document.uri;
    return workspaceLookup.fileChanged(change);
});

function getOmtDocumentResult(document: TextDocument): OmtDocumentInformation {
    let result = documentResults.get(document.uri);
    if (!result) {
        result = omtDocumentInformationProvider.provideDocumentInformation(document);
        documentResults.set(document.uri, result);
    }
    return result;
}

/**
 * find all document links in the document.
 * @returns undefined when the document is not in the current open documents.
 * otherwise `DocumentLink[]`.
 * If a link could not be resolved its target will be left empty and data will be attached
 * so that it can be resolved in the `documentLinkResolve` handler
 * @param params DocumentLinkParams with set textDocument and uri
 */
const documentLinksHandler = (params: DocumentLinkParams) => {
    shutdownCheck();
    const document = documents.get(params.textDocument.uri);
    if (document) {
        return getOmtDocumentResult(document).documentLinks;
    } else {
        return undefined;
    }
}

/**
 * called by the client when a link target was empty.
 * it will try and resolve it using the data on the link.
 * @param link a documenet link without a target
 */
const documentLinkResolve = (link: DocumentLink) => {
    shutdownCheck();
    // the data would have been set during a call to `documentLinksHandler` when the document was opened
    // usually because it would be less efficient to resolve the link at that time.
    link.target = omtDocumentInformationProvider.resolveLink(link.data);
    return link;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
