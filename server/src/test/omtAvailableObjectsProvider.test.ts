import { expect, use } from 'chai';
import { Range } from 'vscode-languageserver';
import { exportedForTesting, getAvailableObjectsFromDocument } from '../omtAvailableObjectsProvider';
import * as sinonChai from 'sinon-chai';
import { parse } from 'yaml';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { OmtImport } from '../types';
use(sinonChai);

describe('OmtAvailableObjectsProvider', () => {
    const document = [
        "DEFINE QUERY test => 'Hello world';",
        "DEFINE COMMAND cmd(param) => param;",
    ].join("\n");
    const queryRegex = /(?<=DEFINE QUERY )(test)(?=[^a-zA-Z])/gm;
    const commandRegex = /(?<=DEFINE COMMAND )(cmd)(?=[^a-zA-Z])/gm;
    const testRange = Range.create({ line: 0, character: 13 }, { line: 0, character: 17 });

    describe('findDefinedObjects', () => {
        it('should return correct object for query', () => {
            // ACT
            const results = exportedForTesting.findDefinedObjects(document, document, "QUERY");

            // ASSERT
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.name).to.equal('test');
            expect(result.range).to.deep.equal(testRange);
        });

        it('should return correct object for query when a number is in the name', () => {
            // ARRANGE
            const documentWithNumberInName = [
                "DEFINE QUERY test2 => 'Hello world';",
                "DEFINE COMMAND cmd2(param) => param;",
            ].join("\n");

            // ACT
            const results = exportedForTesting.findDefinedObjects(documentWithNumberInName, documentWithNumberInName, "QUERY");

            // ASSERT
            const testRangeWithNumber = Range.create({ line: 0, character: 13 }, { line: 0, character: 18 });
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.name).to.equal('test2');
            expect(result.range).to.deep.equal(testRangeWithNumber);
        });
    });

    describe('findRangeWithRegex', () => {
        it('should return correct range for simple query', () => {
            // ACT
            const result = exportedForTesting.findRangeWithRegex(document, queryRegex);

            // ASSERT
            expect(result).to.deep.equal(testRange);
        });

        it('should return correct range for simple command', () => {
            // ACT
            const result = exportedForTesting.findRangeWithRegex(document, commandRegex);

            // ASSERT
            expect(result).to.deep.equal(Range.create({ line: 1, character: 15 }, { line: 1, character: 18 }));
        });

        it('should throw error when definition found multiple times', () => {
            // ARRANGE
            const wrong_document = [
                "DEFINE QUERY test => 'Hello world';",
                "DEFINE QUERY test => 'Hello world 2';",
            ].join("\n");

            // ACT / ASSERT
            expect(() => exportedForTesting.findRangeWithRegex(wrong_document, queryRegex)).throw("2 results found for")
        });

        it('should throw error when definition found zero times', () => {
            // ARRANGE
            const wrong_document = [
                "DEFINE QUERY testTwo => 'Hello world';",
                "DEFINE QUERY testTwo => 'Hello world 2';",
            ].join("\n");

            // ACT / ASSERT
            expect(() => exportedForTesting.findRangeWithRegex(wrong_document, queryRegex)).throw("0 results found for")
        });
    });

    describe('findModelEntries', () => {
        it('should return correct entries', () => {
            // ARRANGE
            const yamlDocument = [
                "model:",
                "    TestActivity: !Activity",
                "        dummy: true",
                "    TestProcedure: !Procedure",
                "        dummy: true",
                "    AnotherTestActivity: !Activity",
                "        dummy: true",
            ].join("\n");
            const parsedDocument = parse(yamlDocument);

            // ACT
            const results = exportedForTesting.findModelEntries(parsedDocument["model"], yamlDocument);

            // ASSERT
            expect(results.length).to.equal(3);
            const resultOne = results[0];
            expect(resultOne.name).to.equal("TestActivity");
            expect(resultOne.range).to.deep.equal({start: {line: 1, character: 4}, end: {line: 1, character: 16}});
            const resultTwo = results[1];
            expect(resultTwo.name).to.equal("TestProcedure");
            expect(resultTwo.range).to.deep.equal({start: {line: 3, character: 4}, end: {line: 3, character: 17}});
            const resultThree = results[2];
            expect(resultThree.name).to.equal("AnotherTestActivity");
            expect(resultThree.range).to.deep.equal({start: {line: 5, character: 4}, end: {line: 5, character: 23}});
        });
    });

    describe('getAvailableObjectsFromDocument', () => {
        it('should return correct object', () => {
            // ARRANGE
            const yamlDocument = [
                "import:",
                "    '@test/file1.omt':",
                "    -   File1Activity",
                "    -   file1Query",
                "commands: |",
                "    DEFINE COMMAND cmd($param) => { @File1Activity($param); }",
                "model:",
                "    AnotherTestActivity: !Activity",
                "        dummy: true",
                "        onDone: |",
                "            @cmd('test');"
            ].join("\n");
            const textDocument = TextDocument.create(`test.omt`, 'omt', 1, yamlDocument);
            const shorthands = new Map<string, string>();
            shorthands.set("@test", "/folder/*");

            // ACT
            const result = getAvailableObjectsFromDocument(textDocument, shorthands);

            // ASSERT
            expect(result.definedObjects.length).to.equal(2);
            const definedCommand = result.definedObjects[0];
            expect(definedCommand.name).to.equal("cmd");
            expect(definedCommand.range).to.deep.equal(Range.create({line: 5, character: 19}, {line: 5, character: 22}));
            const definedActivity = result.definedObjects[1];
            expect(definedActivity.name).to.equal("AnotherTestActivity");
            expect(definedActivity.range).to.deep.equal(Range.create({line: 7, character: 4}, {line: 7, character: 23}));

            expect(result.availableImports.length).to.equal(2);
            const activityImport = result.availableImports[0];
            const expectedActivityImport: OmtImport = { name: "File1Activity", url: "@test/file1.omt", fullUrl: "/folder/file1.omt"}
            expect(activityImport).to.deep.equal(expectedActivityImport);
            const queryImport = result.availableImports[1];
            const expectedQueryImport: OmtImport = { name: "file1Query", url: "@test/file1.omt", fullUrl: "/folder/file1.omt"}
            expect(queryImport).to.deep.equal(expectedQueryImport);
        });

        it('should work when working on imports', () => {
            // ARRANGE
            const yamlDocument = [
                "import:",
                "    ",
            ].join("\n");
            const textDocument = TextDocument.create(`test.omt`, 'omt', 1, yamlDocument);
            const shorthands = new Map<string, string>();

            // ACT
            const result = getAvailableObjectsFromDocument(textDocument, shorthands);

            // ASSERT
            expect(result.availableImports.length).to.equal(0);
            expect(result.definedObjects.length).to.equal(0);
        });

        it('should work when working on imports 2', () => {
            // ARRANGE
            const yamlDocument = [
                "import:",
                "    'test':",
            ].join("\n");
            const textDocument = TextDocument.create(`test.omt`, 'omt', 1, yamlDocument);
            const shorthands = new Map<string, string>();

            // ACT
            const result = getAvailableObjectsFromDocument(textDocument, shorthands);

            // ASSERT
            expect(result.availableImports.length).to.equal(0);
            expect(result.definedObjects.length).to.equal(0);
        });
    });
});
