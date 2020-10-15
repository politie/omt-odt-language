import { join } from 'path';
import { workspace, ExtensionContext, commands, languages, Disposable } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind, DocumentLinkClientCapabilities, ClientCapabilities, DocumentLinkRequest
} from 'vscode-languageclient';
import OMTLinkProvider from './omtLinkProvider';
import { ENETRESET } from 'constants';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    const test: ClientCapabilities = {};

    // The server is implemented in node
    let serverModule = context.asAbsolutePath(
        join('server', 'out', 'server.js')
    );
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        },
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for OMT and ODT documents
        documentSelector: [
            { scheme: 'file', language: 'omt' },
            { scheme: 'file', language: 'odt' },
        ],
        synchronize: {
            // Notify the server about changes to files conforming to these patterns:
            fileEvents: [
                workspace.createFileSystemWatcher('**/*.omt'),
                workspace.createFileSystemWatcher('**/package.json'),
            ],
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'languageServerExample',
        'Language Server Example',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();

    // register document link provider for OMT files
    const providerRegistrations = Disposable.from(
        languages.registerDocumentLinkProvider(
            { scheme: 'file', language: 'omt' },
            new OMTLinkProvider(client))
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
