import * as vscode from "vscode";
import type {
	GetAutoCompleteListOptions,
	UnrealData,
} from "../data/UnrealData";
import { UnrealVariable } from "../data/UnrealVariable";

export class UnrealCompletionProvider implements vscode.CompletionItemProvider {
	constructor(private unrealData: UnrealData) {}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.ProviderResult<vscode.CompletionItem[]> {
		const line = document.lineAt(position.line);
		const lineTextUpToCursor = line.text
			.substring(0, position.character)
			.trim();
		const tokens = lineTextUpToCursor.split(/\s+/);

		const range = document.getWordRangeAtPosition(position);
		const prefix = range ? document.getText(range) : "";

		if (tokens.length >= 1 && tokens[0].toLowerCase() === "class") {
			if (tokens.length >= 3 && tokens[2].toLowerCase() === "extends") {
				return this.getClassCompletions({
					word: prefix,
					hasNoFunctions: true,
					hasNoVariables: true,
				});
			}
			return this.getKeywordCompletions();
		}

		const defaultPropertiesCompletions = this.getDefaultPropertiesCompletions(
			document,
			position,
		);
		if (defaultPropertiesCompletions) {
			return defaultPropertiesCompletions;
		}

		const trimmedLine = line.text.trim();
		const split = trimmedLine.split(/\s+/);
		const firstWord = split[0]?.toLowerCase();
		const isVarDecl =
			["var", "local", "param"].includes(firstWord) ||
			firstWord.includes("var(");
		if (isVarDecl) {
			const secondWord = split[1]?.toLowerCase();
			const isNotArray = !secondWord?.includes("array");
			const isTriggerChar =
				trimmedLine.endsWith("<") || trimmedLine.endsWith("|");

			if (split.length > 1 && isNotArray && isTriggerChar) {
				return this.getMetadataTagCompletions();
			}
		}

		return undefined;
	}

	private getClassCompletions(
		options: GetAutoCompleteListOptions,
	): vscode.CompletionItem[] {
		const classes = this.unrealData.getAutoCompleteList(options);
		return classes.map((name) => {
			const item = new vscode.CompletionItem(
				name,
				vscode.CompletionItemKind.Class,
			);
			item.detail = "UnrealScript Class";
			return item;
		});
	}

	private getKeywordCompletions(): vscode.CompletionItem[] {
		const config = vscode.workspace.getConfiguration("unrealscript");
		const keywords = config.get<string[]>("unrealKeywords") || [];
		return keywords.map((keyword) => {
			const item = new vscode.CompletionItem(
				keyword,
				vscode.CompletionItemKind.Keyword,
			);
			item.detail = "UnrealScript Keyword";
			return item;
		});
	}

	private getDefaultPropertiesCompletions(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.CompletionItem[] | null {
		const lineText = document.lineAt(position.line).text;
		const allText = document.getText();
		const range = document.getWordRangeAtPosition(position);
		const prefix = range ? document.getText(range) : "";

		const defaultPropMatch = allText.match(/defaultproperties/i);
		if (!defaultPropMatch) {
			return null;
		}
		const defaultPropOffset = defaultPropMatch.index ?? 0;
		const defaultPropLine = document.positionAt(defaultPropOffset).line;

		if (position.line < defaultPropLine) {
			return null;
		}

		const trimmed = lineText.trim().toLowerCase();
		if (trimmed.startsWith("begin object class=")) {
			return this.getClassCompletions({
				word: prefix,
				hasNoFunctions: true,
				hasNoVariables: true,
			});
		}

		const inBeginEndBlock = this.detectBeginEndRegion(document, position);
		if (inBeginEndBlock) {
			const classReference = this.unrealData.getClass(
				inBeginEndBlock.className,
			);
			if (!classReference) {
				return null;
			}

			if (classReference.hasParsed()) {
				return this.getClassCompletions({
					word: prefix,
					hasNoClasses: true,
					hasNoFunctions: true,
					fromClass: classReference,
				});
			}
			classReference.parseMe();
			return [
				new vscode.CompletionItem(
					"just a moment...",
					vscode.CompletionItemKind.Text,
				),
			];
		}

		return this.getClassCompletions({
			word: prefix,
			hasNoClasses: true,
			hasNoFunctions: true,
		});
	}

	private detectBeginEndRegion(
		document: vscode.TextDocument,
		position: vscode.Position,
	): { className: string } | null {
		const text = document.getText();
		const lines = text.split("\n");
		const beginRegex = /begin\s+object\s+(class\s*=\s*(\w+))?/i;
		const endRegex = /end\s+object/i;

		const beginLines: { line: number; className?: string }[] = [];
		const endLines: number[] = [];

		for (let i = 0; i < lines.length; i++) {
			const beginMatch = beginRegex.exec(lines[i]);
			if (beginMatch) {
				beginLines.push({ line: i, className: beginMatch[2] });
			} else if (endRegex.test(lines[i])) {
				endLines.push(i);
			}
		}

		for (let i = 0; i < beginLines.length && i < endLines.length; i++) {
			const begin = beginLines[i];
			const end = endLines[i];
			if (position.line > begin.line && position.line < end) {
				return { className: begin.className ?? "" };
			}
		}
		return null;
	}

	private getMetadataTagCompletions(): vscode.CompletionItem[] {
		const config = vscode.workspace.getConfiguration("unrealscript");
		const metadataTags = config.get<string[]>("metadataTags") || [];
		return metadataTags.map((tag) => {
			const item = new vscode.CompletionItem(
				tag,
				vscode.CompletionItemKind.Text,
			);
			item.detail = "UnrealScript Metadata Tag";
			return item;
		});
	}
}
