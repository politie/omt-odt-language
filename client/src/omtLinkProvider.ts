import { DocumentLink, DocumentLinkProvider, TextDocument } from 'vscode';
import { DocumentLinkRequest, CancellationToken, DocumentLinkParams, LanguageClient } from 'vscode-languageclient/node';

/**
 * Proxy for handling OMT document links with LSP
 */
export default class OMTLinkProvider implements DocumentLinkProvider {
    constructor(private client: LanguageClient) { console.log('client has started'); }

    resolveDocumentLink(link: DocumentLink, token: CancellationToken) {
        // resolve in the language server
        return this.client.sendRequest<DocumentLink>('documentLink/resolve', link, token);
    }

    provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        const params: DocumentLinkParams = { textDocument: { uri: document.uri.toString() } };
        // send a request to the language server
        console.log(`going to send ${JSON.stringify(params, undefined, 2)}  to server for document links`)
        return this.client.sendRequest(DocumentLinkRequest.method, params);
    }
}
