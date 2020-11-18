import { expect, use } from 'chai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stub } from 'sinon';
import { DocumentLink, Position, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import OMTLinkProvider from '../omtLinkProvider';
import { WorkspaceLookup } from '../workspaceLookup';
import * as sinonChai from 'sinon-chai';
use(sinonChai);

type Case = {
    i: number,
    line: number,
    start: number,
    end: number,
    should: string,
    target: string | undefined,
    module?: string,
};

describe('OMTLinkProvider', () => {
    let linkProvider: OMTLinkProvider;
    let lookupStub: WorkspaceLookup;

    beforeEach(() => {
        lookupStub = <WorkspaceLookup>{
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            getModulePath: (_module: string) => '',
        };

        linkProvider = new OMTLinkProvider(lookupStub);
    });

    describe('provideDocumentLinks', () => {
        let actualDocumentLinks: DocumentLink[];

        beforeEach(() => {
            const uri = 'testFixture/one/imports.omt';
            const textDocument = TextDocument.create(uri, 'omt', 1, readFileSync(resolve(uri)).toString());

            actualDocumentLinks = linkProvider.provideDocumentLinks(textDocument);
        })

        // test uri links with and without shorthands
        const cases: Case[] = [
            { i: 0, line: 1, start: 1, end: 18, target: undefined, should: 'should make a link for a declared import', module: 'Declared' },
            { i: 1, line: 3, start: 5, end: 20, target: resolve('testFixture/relative.omt'), should: 'should make a link for a relative path' },
            { i: 2, line: 5, start: 4, end: 24, target: resolve('testFixture/one/shorthanded.omt'), should: 'should recognize a shorthand from the tsconfig in current project folder' },
            { i: 3, line: 7, start: 5, end: 29, target: resolve('testFixture/one/quotedShorthand.omt'), should: 'should ignore quotes 1' },
            { i: 4, line: 9, start: 5, end: 35, target: resolve('testFixture/one/doubleQuotedShorthand.omt'), should: 'should ignore quotes 2' },
            { i: 5, line: 11, start: 4, end: 31, target: resolve('testFixture/one/@two/siblingShorthanded.omt'), should: 'should not ignore a shorthand from a sibling path' },
            { i: 6, line: 13, start: 4, end: 27, target: resolve('testFixture/three/parentPathed.omt'), should: 'should recognize a shorthand from the tsconfig in a parent project' },
        ];

        // test all cases
        cases.forEach((value: Case) => {
            it(value.should, () => {
                const { module } = value;
                testLinkProvider(
                    value.i,
                    {
                        range: toRange(value.line, value.start, value.line, value.end),
                        target: value.target,
                        data: module ? { declaredImport: { module } } : undefined,
                    });
            })
        });

        function testLinkProvider(index: number, expectedDocumentLink: DocumentLink) {
            const actualDocumentLink = actualDocumentLinks[index];
            if (expectedDocumentLink.target) {
                expect(actualDocumentLink.target).to.equal(expectedDocumentLink.target, 'target path');
                expect(actualDocumentLink.range).to.deep.equal(expectedDocumentLink.range, 'range');
                expect(actualDocumentLink.data).to.be.undefined;
            } else {
                expect(actualDocumentLink.target).to.equal(undefined, 'target');
                expect(actualDocumentLink.data).not.to.be.undefined;
                expect(actualDocumentLink.data.declaredImport.module).to.eq(expectedDocumentLink.data.declaredImport.module);
            }
        }
    });

    describe('resolveLink', () => {
        it('should resolve declared imports', () => {
            const functionStub = stub(lookupStub, 'getModulePath').returns('modulePath');

            const result = linkProvider.resolveLink({
                declaredImport: {
                    module: 'moduleName'
                }
            });

            expect(functionStub).to.be.calledWith('moduleName');
            expect(result).to.eq('modulePath');
        });

        it('should return undefined when the data is undefined', () => {
            const functionStub = stub(lookupStub, 'getModulePath').returns('modulePath');

            const result = linkProvider.resolveLink(undefined);

            expect(functionStub).not.to.be.called;
            expect(result).to.be.undefined;
        });

        it('should return undefined when the data is not for a declared import', () => {
            const functionStub = stub(lookupStub, 'getModulePath').returns('modulePath');

            let result = linkProvider.resolveLink({
                declaredImport: {}
            });

            expect(functionStub).not.to.be.called;
            expect(result).to.be.undefined;

            result = linkProvider.resolveLink({});

            expect(functionStub).not.to.be.called;
            expect(result).to.be.undefined;
        });
    });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
    const start = Position.create(sLine, sChar);
    const end = Position.create(eLine, eChar);
    return Range.create(start, end);
}
