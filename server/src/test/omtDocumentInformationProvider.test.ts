import { expect, use } from 'chai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SinonStub, stub } from 'sinon';
import { DocumentLink, Position, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import OMTLinkProvider, { exportedForTesting } from '../omtDocumentInformationProvider';
import { WorkspaceLookup } from '../workspaceLookup';
import * as sinonChai from 'sinon-chai';
import { OmtImport, OmtLocalObject } from '../types';
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

    describe('provideDocumentInformation', () => {
        let actualDocumentLinks: DocumentLink[];

        beforeEach(() => {
            const uri = 'testFixture/one/imports.omt';
            const textDocument = TextDocument.create(uri, 'omt', 1, readFileSync(resolve(uri)).toString());
            const errorStub = stub(console, 'error');
            actualDocumentLinks = linkProvider.provideDocumentInformation(textDocument).documentLinks;
            //- called in the catch clause for reading tsconfig-invalid
            expect(errorStub).to.be.calledOnce;
            errorStub.restore();
        })

        // test uri links with and without shorthands
        const cases: Case[] = [
            { i: 0, line: 1, start: 4, end: 19, target: undefined, should: 'should make a link for a declared import', module: 'Declared' },
            { i: 1, line: 3, start: 4, end: 19, target: resolve('testFixture/relative.omt'), should: 'should make a link for a relative path' },
            { i: 2, line: 5, start: 5, end: 29, target: resolve('testFixture/one/quotedShorthand.omt'), should: 'should ignore quotes 1' },
            { i: 3, line: 7, start: 5, end: 35, target: resolve('testFixture/one/doubleQuotedShorthand.omt'), should: 'should ignore quotes 2' },
            { i: 4, line: 9, start: 5, end: 32, target: resolve('testFixture/one/@two/siblingShorthanded.omt'), should: 'should not ignore a shorthand from a sibling path' },
            { i: 5, line: 11, start: 5, end: 28, target: resolve('testFixture/three/parentPathed.omt'), should: 'should recognize a shorthand from the tsconfig in a parent project' },
        ];

        // test all cases
        cases.forEach((value) => {
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

    const testRange = Range.create({ line: 0, character: 13 }, { line: 0, character: 17 });

    describe('getLocalLocationsForCode', () => {
        const lineNumber = 12;
        const declaredObjects: OmtLocalObject[] = [{ name: "test", range: testRange }];
        it('should return correct object when used once', () => {
            // ARRANGE
            const line = "    @test(param1, param2);";

            // ACT
            const results = exportedForTesting.getLocalLocationsForCode(declaredObjects, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.name).to.equal("test");
            expect(result.range.start).to.deep.equal({ line: lineNumber, character: 5 });
            expect(result.range.end).to.deep.equal({ line: lineNumber, character: 9 });
        });

        it('should return no objects when not found', () => {
            // ARRANGE
            const line = "    @testTwo(param1, param2);";

            // ACT
            const results = exportedForTesting.getLocalLocationsForCode(declaredObjects, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(0);
        });

        it('should return correct object when used once as query', () => {
            // ARRANGE
            const line = "    testObject / test";

            // ACT
            const results = exportedForTesting.getLocalLocationsForCode(declaredObjects, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.name).to.equal("test");
            expect(result.range.start).to.deep.equal({ line: lineNumber, character: 17 });
            expect(result.range.end).to.deep.equal({ line: lineNumber, character: 21 });
        });
    });

    describe('getReferencesToOtherFilesForCode', () => {
        const omtImports: OmtImport[] = [{ name: "TestActivity", url: "../test.omt", fullUrl: "/workspace/test.omt" }];
        const lineNumber = 15;

        it('should return correct object', () => {
            // ARRANGE
            const line = "    @TestActivity();";

            // ACT
            const results = exportedForTesting.getReferencesToOtherFilesForCode(omtImports, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.name).to.equal("TestActivity");
            expect(result.range.start).to.deep.equal({ line: lineNumber, character: 5 });
            expect(result.range.end).to.deep.equal({ line: lineNumber, character: 17 });
        });

        it('should return correct object', () => {
            // ARRANGE
            const line = "    @TestActivityTwo();";

            // ACT
            const results = exportedForTesting.getReferencesToOtherFilesForCode(omtImports, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(0);
        });

        it('should return correct object when ending on the same name', () => {
            // ARRANGE
            const line = "    @AnotherTestActivity();";

            // ACT
            const results = exportedForTesting.getReferencesToOtherFilesForCode(omtImports, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(0);
        });

        it('should return no object when name is null', () => {
            // ARRANGE
            const line = "    -   $test / pol:omschrijving = null;";
            // eslint-disable-next-line
            omtImports[0].name = null as any;

            // ACT
            const results = exportedForTesting.getReferencesToOtherFilesForCode(omtImports, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(0);
        });
    });

    describe('getDocumentImportLinks', () => {
        const omtImports: OmtImport[] = [{ name: "TestActivity", url: "../test.omt", fullUrl: "/workspace/test.omt" }];
        const lineNumber = 15;

        it('should return correct object', () => {
            // ARRANGE
            const line = "    '../test.omt':";

            // ACT
            const results = exportedForTesting.getDocumentImportLinks(omtImports, lineNumber, line);

            // ASSERT
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.target).to.equal("/workspace/test.omt");
            expect(result.range.start).to.deep.equal({ line: lineNumber, character: 5 });
            expect(result.range.end).to.deep.equal({ line: lineNumber, character: 16 });
        });
    });

    describe('resolveLink', () => {
        let functionStub: SinonStub;

        beforeEach(() => {
            functionStub = stub(lookupStub, 'getModulePath').returns('modulePath');
        });

        afterEach(() => {
            functionStub.restore();
        });

        it('should resolve declared imports', () => {
            const result = linkProvider.resolveLink({
                declaredImport: {
                    module: 'moduleName'
                }
            });

            expect(functionStub).to.be.calledWith('moduleName');
            expect(result).to.eq('modulePath');
        });

        it('should return undefined when the data is undefined', () => {
            const result = linkProvider.resolveLink(undefined);

            expect(functionStub).not.to.be.called;
            expect(result).to.be.undefined;
        });

        it('should return undefined when the data is not for a declared import', () => {
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
