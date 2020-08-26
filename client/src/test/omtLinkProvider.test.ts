import { DocumentLink, commands, workspace, Uri, Position, Range } from 'vscode';
import { equal, deepEqual } from 'assert';
import { getDocUri, activate } from './helper';

describe('Should make links of imports', () => {
	const docUri = getDocUri('one/imports.omt');
	const expectedCount = 6;
	let actualDocumentLinks: DocumentLink[];

	before(async () => {
		await activate(docUri);
		actualDocumentLinks = (await commands.executeCommand(
			'vscode.executeLinkProvider',
			docUri,
		)) as DocumentLink[];
	});

	it('total link count', () => {
		equal(actualDocumentLinks.length, expectedCount);
	})

	describe('uri imports', () => {
		it('should make a link or a relative path', () => {
			testLinkProvider(0, { range: toRange(3, 4, 3, 19), target: toUri('/relative.omt') });
		});

		it('should recognize a shorthand from the tsconfig in current project folder', () => {
			testLinkProvider(1, { range: toRange(5, 4, 5, 24), target: toUri('/one/shorthanded.omt') });
		});

		it('should recognize a shorthand from the tsconfig in a parent project', () => {
			testLinkProvider(5, { range: toRange(13, 4, 13, 27), target: toUri('/three/parentPathed.omt') });
		});

		it('should not ignore a shorthand from a sibling path', () => {
			// without knowledge of how the project makes path shorthands we cannot determine if something starts with that.
			// therefore it will become a link with an invalid uri and we let the IDE handle that
			// ToDo, determine if it is wise to check if the shorthand is present in other configs and disable the link and give a warning with the language server
			testLinkProvider(4, { range: toRange(11, 4, 11, 31), target: toUri('/one/@two/siblingShorthanded.omt') });
		});

		it('should ignore quotes', () => {
			testLinkProvider(2, { range: toRange(7, 5, 7, 29), target: toUri('/one/quotedShorthand.omt') });
			testLinkProvider(3, { range: toRange(9, 5, 9, 35), target: toUri('/one/doubleQuotedShorthand.omt') });
		});
	});
	function testLinkProvider(index: number, expectedDocumentLink: DocumentLink) {
		const actualDocumentLink = actualDocumentLinks[index];
		equal(actualDocumentLink.target.path, expectedDocumentLink.target.path, 'target');
		deepEqual(actualDocumentLink.range, expectedDocumentLink.range, 'range');
	}
});

function toUri(relPath: string): Uri {
	return Uri.file(workspace.rootPath + relPath);
}

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
	const start = new Position(sLine, sChar);
	const end = new Position(eLine, eChar);
	return new Range(start, end);
}
