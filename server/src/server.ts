import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    InitializeResult,
    DocumentLinkParams,
    DocumentLink
} from 'vscode-languageserver';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import OMTLinkProvider from './omtLinkProvider';
import { WorkspaceLookup } from './workspaceLookup';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDocumentLinkCapabilities = false;
let omtLinkProvider: OMTLinkProvider;
let workspaceLookup: WorkspaceLookup;

// tell the client what functionality is supported in this LSP when it initializes.
connection.onInitialize((params: InitializeParams) => {
    shutdownCheck();
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    hasDocumentLinkCapabilities = !!capabilities.textDocument?.documentLink;

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
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
    omtLinkProvider = new OMTLinkProvider(workspaceLookup);
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    shutdownCheck();
    return workspaceLookup.fileChanged(change);
});

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
        return omtLinkProvider.provideDocumentLinks(document)
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
    link.target = omtLinkProvider.resolveLink(link.data);
    return link;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
