import * as vscode from "vscode";
import type { ClassReference } from "../data/UnrealClassReference";
import type { GetObjectOptions, UnrealData } from "../data/UnrealData";

interface DefinitionTarget {
	file: string;
	line: number;
	character: number;
}

export class UnrealDefinitionProvider implements vscode.DefinitionProvider {
	constructor(private unrealData: UnrealData) {}

	public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.ProviderResult<vscode.Definition> {
		const line = document.lineAt(position).text;
		const wordRange = document.getWordRangeAtPosition(position);
		if (!wordRange) return;
		const word = document.getText(wordRange);
		const leftLine = line.split(word)[0].trim();

		const activeFile = document.fileName;

		const goTo = new GoToDefinitionHelper(this.unrealData);
		const target = goTo.resolveTarget(leftLine, word, line, activeFile);
		if (!target) return;

		return new vscode.Location(
			vscode.Uri.file(target.file),
			new vscode.Position(target.line, target.character),
		);
	}
}

class GoToDefinitionHelper {
	constructor(private unrealData: UnrealData) {}

	public resolveTarget(
		leftLine: string,
		word: string,
		fullLine: string,
		activeFile: string,
	): DefinitionTarget | null {
		console.debug(
			`resolveTarget - leftLine: ${leftLine}, word: ${word}, fullLine: ${fullLine}`,
		);
		if (
			fullLine.includes("function") ||
			fullLine.includes("event") ||
			leftLine.endsWith("super.")
		) {
			const success = this.getAndOpenObject(word, this.unrealData, {
				hasNoFunctions: true,
				hasNoVariables: true,
			});
			if (success) return success;

			const parentClass = this.unrealData
				.getClassFromFileName(activeFile)
				?.getParent();
			if (parentClass) {
				return this.getAndOpenObject(word, parentClass, { hasNoClasses: true });
			}
			return null;
		}

		if (leftLine === "" || leftLine.endsWith("self.")) {
			switch (word) {
				case "super": {
					const parentClass = this.unrealData
						.getClassFromFileName(activeFile)
						?.getParent();
					if (parentClass) {
						return this.getAndOpenObject(
							parentClass.getName(),
							this.unrealData,
						);
					}
					break;
				}
				case "self": {
					const className = this.unrealData
						.getClassFromFileName(activeFile)
						?.getName();
					if (className) {
						return this.getAndOpenObject(className, this.unrealData);
					}
					break;
				}
				default:
					return this.getAndOpenObject(word, this.unrealData);
			}
		}

		if (leftLine.endsWith(".")) {
			const contextClass = this.unrealData.getClassFromContext(leftLine);
			console.debug("contextClass: ", contextClass?.getName());
			if (contextClass) {
				return this.getAndOpenObject(word, contextClass, {
					hasNoClasses: true,
				});
			}
			return null;
		}

		console.debug("case not handled!!!", leftLine);
		return null;
	}

	private getAndOpenObject(
		word: string,
		outOf: ClassReference | UnrealData,
		options: GetObjectOptions = {},
	): DefinitionTarget | null {
		const window = vscode.window;
		console.debug("getAndOpenObject", word, outOf, options);
		const object = this.unrealData.getObject(word, outOf, options);

		if (object) {
			return {
				file: object.entity.getFileName(),
				line: object.entity.getLineNumber(),
				character: 0,
			};
		}
		window.setStatusBarMessage("Just a moment...");
		return null;
	}
}
