import { expect } from "chai";
import { SinonStub, stub } from "sinon";
import { parseOmtFile, parseOmtText } from "../omtFileParser";
import * as fs from 'fs';
import { CheckFileResult } from "../types";

describe('omtFileParser', () => {
    describe('parseOmtText', () => {
        type MatchCase = { rule: string, shouldMatch: boolean, text: string, name?: string }
        const cases: MatchCase[] = [
            { text: 'moduleName: n', rule: 'moduleName at start of sentence', shouldMatch: true, name: 'n' },
            { text: ' moduleName: n', rule: 'moduleName should be at the start of the sentence', shouldMatch: false },
            { text: 'moduleName:n', rule: 'there should be one space before the name', shouldMatch: false },
            { text: 'moduleName: n n', rule: 'there may be only one name', shouldMatch: false },
            { text: 'moduleName: ', rule: 'there should be a name', shouldMatch: false },
            { text: 'moduleName: n ', rule: 'a single trailing whitespace is allowed', shouldMatch: true, name: 'n' },
            { text: 'moduleName: n  ', rule: 'multiple trailing whitespaces are not allowed', shouldMatch: false },
            { text: 'moduleName: aB_1', rule: 'valid characters', shouldMatch: true, name: 'aB_1' },
            { text: 'moduleName: n #comment', rule: 'comments after a module defenition are allowed', shouldMatch: true, name: 'n' },
        ]

        cases.forEach((value) => {
            it(`checks rule: ${value.rule}`, () => {
                const result = parseOmtText(value.text);
                if (value.shouldMatch) {
                    expect(result.module).not.to.be.undefined;
                    expect(result.module?.name).to.eq(value.name);
                } else {
                    expect(result.module).to.be.undefined;
                }
            });
        });

    });

    describe('parseOmtFile', () => {
        let readFileStub: SinonStub;

        beforeEach(() => {
            readFileStub = stub(fs, 'readFile');
        });

        afterEach(() => {
            readFileStub.restore();
        })

        it('should throw an error when access to the filesystem fails', (done) => {
            const uri = `file:///validPath.omt`
            parseOmtFile(uri)
                .then(() => {
                    expect.fail();
                }, (reason) => {
                    // test if the error results in a rejection
                    expect(reason).to.eq('error message');
                    done();
                });
            // act - have the filesystem return an error
            readFileStub.callArgWith(2, 'error message');

        });

        it('should use parseOmtText when it read a file and return the results', (done) => {
            const uri = `/invalidPath.omt`
            parseOmtFile(uri)
                .then((result: CheckFileResult) => {
                    expect(result.module).not.to.be.undefined;
                    expect(result.module?.name).to.eq('n');
                    expect(result.path).to.eq(uri);
                    done();
                }, () => {
                    expect.fail();
                });
            // act - have the filesystem return a valid module definition text
            readFileStub.callArgWith(2, undefined, 'moduleName: n');
        });
    });
})
