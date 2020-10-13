import * as path from 'path';
import { DocumentLink, DocumentLinkProvider, TextDocument } from 'vscode';
import { Position, Range, Uri, workspace } from 'vscode';
import { readFileSync } from 'fs';
import { LanguageClient, DocumentLinkRequest, CancellationToken, DocumentLinkParams, TextDocumentIdentifier } from 'vscode-languageclient';
import { debug } from 'console';
import { doc } from './test/helper';

const MATCHER = /( +["']?)(.*\.omt)/;
const importMatch = /^import:/g;
const otherDeclareMatch = /^(\w+):/g;

/**
 * Proxy for handling OMT document links with LSP
 */
export default class OMTLinkProvider implements DocumentLinkProvider {
    constructor(private client: LanguageClient) {

    }

    resolveDocumentLink(link: DocumentLink, token: CancellationToken) {
        this.client.sendRequest(DocumentLinkRequest.method, token);
        return null;
    }

    provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        const params: DocumentLinkParams = { textDocument: { uri: document.uri.toString() } };
        // send a request to the language server
        return this.client.sendRequest(DocumentLinkRequest.method, params);
    }
}
