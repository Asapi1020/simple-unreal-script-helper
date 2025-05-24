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
		if (!wordRange) {
			return;
		}
		const word = document.getText(wordRange);
		const leftLine = line.substring(0, wordRange.start.character).trim();

		const activeFile = document.fileName;

		const goTo = new GoToDefinitionHelper(this.unrealData);
		const target = goTo.resolveTarget(leftLine, word, line, activeFile);
		if (!target) {
			return;
		}

		return new vscode.Location(vscode.Uri.file(target.file), new vscode.Position(target.line, target.character));
	}
}

class GoToDefinitionHelper {
	constructor(private unrealData: UnrealData) {}

	public resolveTarget(leftLine: string, word: string, fullLine: string, activeFile: string): DefinitionTarget | null {
		console.debug(`resolveTarget - leftLine: ${leftLine}, word: ${word}, fullLine: ${fullLine}`);

		const thisClass = this.unrealData.getClassFromFileName(activeFile);
		if (!thisClass) {
			console.warn("active class is null", activeFile);
			return null;
		}

		if (GoToDefinitionHelper.isFunctionOrEvent(leftLine) || leftLine.toLowerCase().endsWith("super.")) {
			const classDef = this.getObjectDef(word, this.unrealData, {
				hasNoFunctions: true,
				hasNoVariables: true,
			});
			if (classDef) {
				return classDef;
			}

			let parentClass = thisClass.safeLoadParent();
			while (parentClass) {
				const parentsObjectDef = this.getObjectDef(word, parentClass, {
					hasNoClasses: true,
				});
				if (parentsObjectDef) {
					return parentsObjectDef;
				}
				parentClass = parentClass.safeLoadParent();
			}
			return null;
		}

		if (
			leftLine === "" ||
			leftLine.toLowerCase() === "foreach" ||
			GoToDefinitionHelper.isInBracketVariable(leftLine) ||
			GoToDefinitionHelper.endsWithOperator(leftLine)
		) {
			switch (word.toLowerCase()) {
				case "super": {
					const parentClass = thisClass.safeLoadParent();
					if (parentClass) {
						return this.getObjectDef(parentClass.getName(), this.unrealData);
					}
					break;
				}
				case "self": {
					const className = thisClass.getName();
					if (className) {
						return this.getObjectDef(className, this.unrealData);
					}
					break;
				}
				default:
					return this.getObjectDef(word, thisClass) ?? this.getObjectDef(word, this.unrealData);
			}
		}

		if (leftLine.toLowerCase().endsWith("self.")) {
			const objectDef = this.getObjectDef(word, thisClass, {
				hasNoClasses: true,
			});
			return objectDef;
		}

		if (leftLine.endsWith(".")) {
			const operatorMatch = [...leftLine.matchAll(/[+\-*/%&|^!<>=]/g)];
			const lastMatch = operatorMatch.at(-1);
			const operatorTrimmed = lastMatch ? leftLine.slice(lastMatch.index + 1).trim() : leftLine;

			const foreachMatch = operatorTrimmed.match(/foreach\s*(.*)/i);
			const foreachTrimmed = foreachMatch ? foreachMatch[1].trim() : operatorTrimmed;
			const staticTrimmed = foreachTrimmed.replace(/static\./gi, "");

			const contextClass = this.unrealData.getClassFromContext(staticTrimmed, thisClass);
			if (contextClass) {
				return this.getObjectDef(word, contextClass, {
					hasNoClasses: true,
				});
			}
			return null;
		}

		if (leftLine.toLowerCase().endsWith("class'")) {
			const objectDef = this.getObjectDef(word, this.unrealData, {
				hasNoFunctions: true,
				hasNoVariables: true,
			});
			if (objectDef) {
				return objectDef;
			}
		}

		console.debug("case not handled for: ", leftLine);
		return null;
	}

	private getObjectDef(
		word: string,
		outOf: ClassReference | UnrealData,
		options: GetObjectOptions = {},
	): DefinitionTarget | null {
		const object = this.unrealData.getObject(word, outOf, options);

		if (object) {
			return {
				file: object.getFileName(),
				line: object.getLineNumber(),
				character: 0,
			};
		}
		return null;
	}

	static isFunctionOrEvent(line: string): boolean {
		return (line.toLowerCase().includes("function") || line.toLowerCase().includes("event")) && !line.includes("{");
	}

	static isInBracketVariable(line: string): boolean {
		return (
			(line.endsWith("{") || line.endsWith(";") || line.endsWith("(") || line.split("(").pop()?.trim().endsWith(",")) ??
			false
		);
	}

	static endsWithOperator(line: string): boolean {
		const OPERATOR_REGEX = /[+\-*/%&|^!<>=]$/;
		const lowerCaseLine = line.toLowerCase();
		return OPERATOR_REGEX.test(lowerCaseLine.trim());
	}
}
