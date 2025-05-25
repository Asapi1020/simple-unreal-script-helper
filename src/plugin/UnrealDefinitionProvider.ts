import * as vscode from "vscode";
import type { Context } from "./Context";

export class UnrealDefinitionProvider implements vscode.DefinitionProvider {
	private context: Context;

	constructor(context: Context) {
		this.context = context;
	}

	public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.ProviderResult<vscode.Definition> {
		const line = document.lineAt(position).text;
		const wordRange = document.getWordRangeAtPosition(position);
		if (!wordRange) {
			return;
		}
		const word = document.getText(wordRange);
		const leftLine = line.substring(0, wordRange.start.character).trim();

		const activeFile = document.fileName;

		console.debug(`resolveTarget - leftLine: ${leftLine}, word: ${word}, fullLine: ${line}`);
		const target = this.context.usecase.definitionUsecase.resolveTarget(leftLine, word, activeFile);
		if (!target) {
			return;
		}

		return new vscode.Location(vscode.Uri.file(target.file), new vscode.Position(target.line, target.character));
	}
}
