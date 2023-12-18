import { expect } from 'chai';
import { getDiMatch, getUriMatch } from "../importMatch";
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('importMatch', () => {
    describe('getDiMatch', () => {
        it('should return correct module when match', () => {
            const result = getDiMatch("module:TestModule");
            expect(result).to.equal("TestModule");
        });

        it('should return undefined when no match', () => {
            const result = getDiMatch("'folder/structure.omt'");
            expect(result).to.be.undefined;
        });
    });

    describe('getUriMatch', () => {
        const folder = "/hello/world";
        const dummyTextDocument: TextDocument = TextDocument.create(`${folder}/test.omt`, 'omt', 1, "hello world");
        const shorthands: Map<string, string> = new Map<string, string>([
            ["@shared", "/src/shared/*"],
            ["@hello/world", "/hello/world.omt"],
        ]);

        it('should replace shorthands', () => {
            const result = getUriMatch("@shared/test.omt", dummyTextDocument, shorthands);
            expect(result).to.equal("/src/shared/test.omt");
        });

        it('should keep full url', () => {
            const result = getUriMatch("/main/test.omt", dummyTextDocument, shorthands);
            expect(result).to.equal("/main/test.omt");
        });

        it('should replace relative path', () => {
            const result = getUriMatch("./test2.omt", dummyTextDocument, shorthands);
            expect(result).to.equal(`${folder}/test2.omt`);
        });

        it('should replace relative path parent folder', () => {
            const result = getUriMatch("../test2.omt", dummyTextDocument, shorthands);
            expect(result).to.equal("/hello/test2.omt");
        });

        it('should replace shorthands to direct path', () => {
            const result = getUriMatch("@hello/world", dummyTextDocument, shorthands);
            expect(result).to.equal("/hello/world.omt");
        });
    });
});
