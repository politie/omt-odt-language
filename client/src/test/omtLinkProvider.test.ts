import { DocumentLink, Position, Range } from 'vscode';
import { getDocUri, activate } from './helper';
import { stub } from 'sinon';
import { DocumentLinkRequest, LanguageClient } from 'vscode-languageclient';

describe('OMTLinkProvider', () => {
    const docUri = getDocUri('one/imports.omt');
    let sendRequestStub;

    before(async () => {
        sendRequestStub = stub(LanguageClient.prototype, 'sendRequest')
            .returns(Promise.resolve([
                new DocumentLink(toRange(1, 4, 1, 19))
            ]));

        await activate(docUri);
    });

    it('should request documentlinks from the server', () => {
        // only test if the omtLinkProvider calls the right server functions
        // and if it is called when the document is loaded
        // the making of the links should be tested for the server
        // and the rendering of the links is the responsibility of vscode
        sendRequestStub.calledWith(
            DocumentLinkRequest.method,
            { textDocument: { uri: docUri.toString() } });
    });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
    const start = new Position(sLine, sChar);
    const end = new Position(eLine, eChar);
    return new Range(start, end);
}
