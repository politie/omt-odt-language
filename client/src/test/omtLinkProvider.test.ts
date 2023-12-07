import { DocumentLink, Position, Range } from 'vscode';
import { getDocUri, activate } from './helper';
import { SinonStub, stub } from 'sinon';
import { LanguageClient } from 'vscode-languageclient/node';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
use(sinonChai);

describe('OMTLinkProvider', () => {
    const docUri = getDocUri('one/imports.omt');
    let sendRequestStub: SinonStub;

    before('set stub', () => {
        sendRequestStub = stub(LanguageClient.prototype, 'sendRequest')
            .resolves([
                new DocumentLink(toRange(1, 4, 1, 19)),
            ]);
    });

    after('cleanup', () => {
        sendRequestStub.restore();
    });

    it('should request documentlinks from the server', async () => {
        // only test if the omtLinkProvider calls the right server functions
        // and if it is called when the document is loaded
        // the making of the links should be tested for the server
        // and the rendering of the links is the responsibility of vscode
        const requestMethod = "textDocument/documentLink";

        await activate(docUri);
        await new Promise(resolve => setTimeout(resolve, 1_500)); // language client needs some extra startup time apparently

        expect(sendRequestStub).to.be.calledWith(requestMethod, { textDocument: { uri: docUri.toString() } });
    });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
    const start = new Position(sLine, sChar);
    const end = new Position(eLine, eChar);
    return new Range(start, end);
}
