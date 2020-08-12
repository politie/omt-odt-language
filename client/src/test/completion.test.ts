import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

suite('Should do completion', () => {
	const omtDocUri = getDocUri('completion.omt');

	test('Completes static items in omt file', async () => {
		/** these just static items in the completion list,
		 * they will be autocompleted in the supported docunments
		 */
		await testCompletion(omtDocUri, new vscode.Position(0, 0), {
			items: [
				{ label: 'JavaScript', kind: vscode.CompletionItemKind.Text },
				{ label: 'TypeScript', kind: vscode.CompletionItemKind.Text },
			]
		});
	});
});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletionList: vscode.CompletionList
) {
	await activate(docUri);

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualCompletionList = (await vscode.commands.executeCommand(
		'vscode.executeCompletionItemProvider',
		docUri,
		position
	)) as vscode.CompletionList;
	actualCompletionList.items.forEach(i => console.log(i.label));
	assert.ok(actualCompletionList.items.length >= 2);
	expectedCompletionList.items.forEach((expectedItem, i) => {
		const actualItem = actualCompletionList.items[i];
		assert.equal(actualItem.label, expectedItem.label);
		assert.equal(actualItem.kind, expectedItem.kind);
	});
}
