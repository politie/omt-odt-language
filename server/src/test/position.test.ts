import { Position, Range } from "vscode-languageserver-types";
import {
    comparePositions,
    forEachAvailableObjectForLink,
    positionInRange,
} from "../position";
import { OmtAvailableObjects, OmtLocalObject } from "../types";
import { expect } from "chai";
import { resolve } from 'path';
import { stub } from "sinon";
import OmtDocumentInformationProvider from "../omtDocumentInformationProvider";

describe("position", () => {
    function positionToString(position: Position): string {
        return `Ln ${position.line}, Col ${position.character}`;
    }
    function rangeToString(range: Range): string {
        return `${positionToString(range.start)} - ${positionToString(
            range.end
        )}`;
    }
    describe("comparePositions", () => {
        const cases = [
            {
                firstPosition: Position.create(1, 10),
                secondPosition: Position.create(1, 20),
                expectedResult: -1,
            },
            {
                firstPosition: Position.create(1, 10),
                secondPosition: Position.create(1, 10),
                expectedResult: 0,
            },
            {
                firstPosition: Position.create(1, 10),
                secondPosition: Position.create(1, 5),
                expectedResult: 1,
            },
            {
                firstPosition: Position.create(0, 5),
                secondPosition: Position.create(1, 5),
                expectedResult: -1,
            },
            {
                firstPosition: Position.create(1, 5),
                secondPosition: Position.create(0, 5),
                expectedResult: 1,
            },
        ];

        cases.forEach((x) => {
            it(`compare ${positionToString(
                x.firstPosition
            )} with ${positionToString(x.secondPosition)} should return ${
                x.expectedResult
            }`, () => {
                expect(
                    comparePositions(x.firstPosition, x.secondPosition)
                ).to.equal(x.expectedResult);
            });
        });
    });

    describe("positionInRange", () => {
        const cases = [
            {
                position: Position.create(0, 5),
                range: Range.create(
                    { line: 0, character: 5 },
                    { line: 0, character: 10 }
                ),
                expectedResult: true,
            },
            {
                position: Position.create(0, 10),
                range: Range.create(
                    { line: 0, character: 5 },
                    { line: 0, character: 10 }
                ),
                expectedResult: true,
            },
            {
                position: Position.create(0, 4),
                range: Range.create(
                    { line: 0, character: 5 },
                    { line: 0, character: 10 }
                ),
                expectedResult: false,
            },
            {
                position: Position.create(0, 11),
                range: Range.create(
                    { line: 0, character: 5 },
                    { line: 0, character: 10 }
                ),
                expectedResult: false,
            },
            {
                position: Position.create(1, 7),
                range: Range.create(
                    { line: 0, character: 5 },
                    { line: 0, character: 10 }
                ),
                expectedResult: false,
            },
            {
                position: Position.create(0, 7),
                range: Range.create(
                    { line: 1, character: 5 },
                    { line: 1, character: 10 }
                ),
                expectedResult: false,
            },
        ];

        cases.forEach((x) => {
            const expectedResultString = x.expectedResult
                ? "should"
                : "shouln't";
            it(`position ${positionToString(
                x.position
            )} ${expectedResultString} fall into the range ${rangeToString(
                x.range
            )}`, () => {
                expect(positionInRange(x.position, x.range)).to.equal(
                    x.expectedResult
                );
            });
        });
    });

    describe("forEachAvailableObjectForLink", () => {
        class OmtDocumentInformationProviderStub {
            private tsConfigFiles: string[] = [];
            private workspaceLookup = null as unknown;

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            provideDocumentInformation(..._: unknown[]){
                return {documentLinks: [], calledObjects: [], definedObjects: [], availableImports: []};
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            provideAvailableObjectsFromDocument(..._: unknown[]){
                return {definedObjects: [], availableImports: []};
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            contextPaths(..._: unknown[]) {
                return new Map<string, string>();
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            getOmtDocumentInformation(..._: unknown[]) { 
                return {documentLinks: [], calledObjects: [], definedObjects: [], availableImports: []};
            }
        }
        const omtDocumentInformationProvider = (new OmtDocumentInformationProviderStub() as unknown) as OmtDocumentInformationProvider;

        const linkUrlString = "file/file1.txt";
        
        const link = {
            name: "HelloWorld",
            range: Range.create(
                { line: 0, character: 10 },
                { line: 0, character: 20 }
            ),
            parameters: [],
        };
        const callbackfn = (
            linkUrl: string,
            omtLocalObject: OmtLocalObject
        ) => ({ linkUrl, omtLocalObject });
        
        it("should return no objects when empty", () => {
            // ARRANGE
            const availableObjects = {
                definedObjects: [],
                availableImports: [],
            };

            // ACT
            const result = forEachAvailableObjectForLink(
                omtDocumentInformationProvider,
                linkUrlString,
                availableObjects,
                link,
                callbackfn
            );

            // ASSERT
            expect(result.length).to.equal(0);
        });

        it("should return one objects when defined", () => {
            // ARRANGE
            const availableObjects: OmtAvailableObjects = {
                definedObjects: [{name: 'HelloWorld', range: Range.create({line: 10, character: 10}, {line: 10, character: 20}), parameters: []}],
                availableImports: [],
            };

            // ACT
            const result = forEachAvailableObjectForLink(
                omtDocumentInformationProvider,
                linkUrlString,
                availableObjects,
                link,
                callbackfn
            );

            // ASSERT
            expect(result.length).to.equal(1);
            expect(result[0].linkUrl).to.equal(linkUrlString);
            expect(result[0].omtLocalObject).to.deep.equal(availableObjects.definedObjects[0])
        });

        it("should return one objects when imported and defined in import", () => {
            // ARRANGE
            const uri = 'testFixture/one/imports.omt';
            const fullUrl = resolve(uri);
            const availableObjects: OmtAvailableObjects = {
                definedObjects: [],
                availableImports: [{name: 'HelloWorld', url: 'imports.omt', fullUrl: fullUrl}],
            };
            const range = Range.create({line: 0, character: 10}, {line: 0, character: 20});
            const importFileOmtAvailableObjects = {availableImports: [], definedObjects: [{name: 'HelloWorld', range: range, parameters: []}]};
            const provideAvailableObjectsFromDocumentStub = stub(omtDocumentInformationProvider, "provideAvailableObjectsFromDocument").returns(importFileOmtAvailableObjects);

            // ACT
            const result = forEachAvailableObjectForLink(
                omtDocumentInformationProvider,
                linkUrlString,
                availableObjects,
                link,
                callbackfn
            );

            // ASSERT
            expect(provideAvailableObjectsFromDocumentStub).to.have.been.calledOnce;
            expect(result.length).to.equal(1);
            expect(result[0].linkUrl).to.equal(fullUrl);
            expect(result[0].omtLocalObject).to.deep.equal(importFileOmtAvailableObjects.definedObjects[0])
        });
    });
});
