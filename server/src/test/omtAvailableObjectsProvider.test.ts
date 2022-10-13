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
        "DEFINE COMMAND cmd-1(param) => param;",
        "DEFINE COMMAND cmd_2($param1, $param2) => param;",
    ].join("\n");
    const queryRegex = /(?<=DEFINE QUERY )(test)(?=\W)/gm;
    const commandRegex = /(?<=DEFINE COMMAND )(cmd-1)(?=\W)/gm;
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
            expect(result.parameters).to.deep.equal([]);
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

        it('should return correct object for command with parameter', () => {
            // ACT
            const results = exportedForTesting.findDefinedObjects(document, document, "COMMAND");

            // ASSERT
            expect(results.length).to.equal(2);
            const result = results[0];
            expect(result.name).to.equal('cmd-1');
            expect(result.range).to.deep.equal(Range.create({ line: 1, character: 15 }, { line: 1, character: 20 }));
            expect(result.parameters).to.deep.equal(['param']);

            const result2 = results[1];
            expect(result2.name).to.equal('cmd_2');
            expect(result2.range).to.deep.equal(Range.create({ line: 2, character: 15 }, { line: 2, character: 20 }));
            expect(result2.parameters).to.deep.equal(['$param1', '$param2']);
        });

        it('should return correct object for query multiple lines', () => {
            // ARRANGE
            const documentNewLines = [
                "DEFINE QUERY test",
                "    => 'Hello world';"
            ].join("\n");

            // ACT
            const results = exportedForTesting.findDefinedObjects(documentNewLines, documentNewLines, "QUERY");

            // ASSERT
            expect(results.length).to.equal(1);
            const result = results[0];
            expect(result.name).to.equal('test');
            expect(result.range).to.deep.equal(testRange);
            expect(result.parameters).to.deep.equal([]);
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
            expect(result).to.deep.equal(Range.create({ line: 1, character: 15 }, { line: 1, character: 20 }));
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
            expect(resultOne.range).to.deep.equal({ start: { line: 1, character: 4 }, end: { line: 1, character: 16 } });
            const resultTwo = results[1];
            expect(resultTwo.name).to.equal("TestProcedure");
            expect(resultTwo.range).to.deep.equal({ start: { line: 3, character: 4 }, end: { line: 3, character: 17 } });
            const resultThree = results[2];
            expect(resultThree.name).to.equal("AnotherTestActivity");
            expect(resultThree.range).to.deep.equal({ start: { line: 5, character: 4 }, end: { line: 5, character: 23 } });
        });
        it('should return correct entry with parameters', () => {
            // ARRANGE
            const yamlDocument = [
                "model:",
                "    TestActivity: !Activity",
                "        dummy: true",
                "        params:",
                "        -   $paramOne",
                "        -   $paramTwo",
            ].join("\n");
            const parsedDocument = parse(yamlDocument);

            // ACT
            const results = exportedForTesting.findModelEntries(parsedDocument["model"], yamlDocument);

            // ASSERT
            expect(results.length).to.equal(1);
            const resultOne = results[0];
            expect(resultOne.name).to.equal("TestActivity");
            expect(resultOne.range).to.deep.equal({ start: { line: 1, character: 4 }, end: { line: 1, character: 16 } });
            expect(resultOne.parameters).to.deep.equal(["$paramOne", "$paramTwo"]);
        });
    });

    describe('trimAndSplitParameterString', () => {
        it('should remove parentheses and trim/split', () => {
            // ARRANGE
            const inputValue = "( $param1, $param2)";

            // ACT
            const output = exportedForTesting.trimAndSplitParameterString(inputValue);

            // ASSERT
            expect(output).to.deep.equal(["$param1", "$param2"]);
        });
    });

    describe('instanceWithParams', () => {
        it('should return true if an object is passed with the params object', () => {
            // ARRANGE
            const input = {
                params: ["param1", "param2"],
                title: "Hello world",
            };

            // ACT
            const output = exportedForTesting.instanceWithParams(input);

            // ASSERT
            expect(output).to.be.true;
        });

        it('should return false if an object is passed without the params object', () => {
            // ARRANGE
            const input = {
                title: "Hello world",
            };

            // ACT
            const output = exportedForTesting.instanceWithParams(input);

            // ASSERT
            expect(output).to.be.false;
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
            expect(definedCommand.range).to.deep.equal(Range.create({ line: 5, character: 19 }, { line: 5, character: 22 }));
            const definedActivity = result.definedObjects[1];
            expect(definedActivity.name).to.equal("AnotherTestActivity");
            expect(definedActivity.range).to.deep.equal(Range.create({ line: 7, character: 4 }, { line: 7, character: 23 }));

            expect(result.availableImports.length).to.equal(2);
            const activityImport = result.availableImports[0];
            const expectedActivityImport: OmtImport = { name: "File1Activity", url: "@test/file1.omt", fullUrl: "/folder/file1.omt" }
            expect(activityImport).to.deep.equal(expectedActivityImport);
            const queryImport = result.availableImports[1];
            const expectedQueryImport: OmtImport = { name: "file1Query", url: "@test/file1.omt", fullUrl: "/folder/file1.omt" }
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
