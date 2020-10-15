import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult, DocumentLinkParams, DocumentLink
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import OMTLinkProvider from './omtLinkProvider';
import { WorkspaceLookup } from './workspaceLookup';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;
let hasDocumentLinkCapabilities: boolean = false;
let omtLinkProvider: OMTLinkProvider;
let workspaceLookup: WorkspaceLookup;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	hasDocumentLinkCapabilities = !!(
		capabilities.textDocument &&
		capabilities.textDocument.documentLink
	);

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

connection.onInitialized(() => {
	workspaceLookup = new WorkspaceLookup(connection.workspace);
	omtLinkProvider = new OMTLinkProvider(workspaceLookup);

	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasDocumentLinkCapabilities) {
		connection.onDocumentLinks(documentLinksHandler);
		connection.onDocumentLinkResolve(documentLinkResolve);
	}
	workspaceLookup.scanForOMTModules();
});


function shutdownCheck() {
	if (isShuttingDown) {
		throw new Error('LSP server is shutting down');
	}
}

/* TODO implement shutdown protocol
 * The protocol can be found here: https://microsoft.github.io/language-server-protocol/specification#shutdown
 * It states that after this request has been received all other requests should return an error response
 * except for the exit notification. That should return an error when it has not been called.
 */
let isShuttingDown = false;
connection.onShutdown(() => {
	shutdownCheck();
	isShuttingDown = true;
	// TODO: destroy anything we need to, like:
	// omtLinkProvider
	// workspaceLookup
});
connection.onExit(() => {
	if (!isShuttingDown) {
		throw new Error('LSP server is not shutting down');
	}
	// TODO: finish the server process
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(() => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
	}
});

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	// console.log('server.onDidChangeContent');
	return workspaceLookup.fileChanged(change);
});


// scans for document links in a document usually when it is opened
const documentLinksHandler = (params: DocumentLinkParams) => {
	// console.log('server.documentLinksHandler');
	const document = documents.get(params.textDocument.uri);
	if (document) {
		return omtLinkProvider.provideDocumentLinks(document);
	} else {
		return undefined;
	}
}

const documentLinkResolve = (link: DocumentLink) => {
	// console.log(`server.documentLinkResolve`)
	link.target = omtLinkProvider.resolve(link.data);
	return Promise.resolve(link);
}

// to debug that no other request is being sent instead of what we expect
connection.onRequest((method: string) => {
	console.log('server.onRequest: ' + method);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
