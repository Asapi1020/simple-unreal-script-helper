import * as vscode from "vscode";
import type { VariableBase } from "./SymbolEntity";
import { printToPanel } from "./data";

export class UnrealVariable implements VariableBase {
	private modifiers: string[];
	private name: string;
	private comment: string;
	private description: string;
	private fileName: string;
	private lineNumber: number;

	constructor(
		modifiers: string[],
		name: string,
		comment: string,
		lineNumber: number,
		fileName: string,
		description = "",
	) {
		this.modifiers = modifiers;
		this.name = name;
		this.comment = comment;
		this.description = description;
		this.fileName = fileName;
		this.lineNumber = lineNumber;
	}

	public getModifiers(): string {
		return `${this.modifiers.join(" ")} `;
	}

	public getType(secondaryLevel = 0, newType = ""): string {
		const arrayOrClassIndex = this.modifiers.findIndex(
			(mod) => mod.includes("Array") || mod.includes("Class"),
		);

		const type =
			newType ||
			(arrayOrClassIndex >= 0
				? this.modifiers.slice(arrayOrClassIndex).join(" ").trim()
				: this.modifiers[this.modifiers.length - 1].trim());

		if (secondaryLevel > 0) {
			const parts = type.split("<").slice(1);
			return this.getType(secondaryLevel - 1, parts.join("<"));
		}

		const lowerType = type.toLowerCase();
		if (lowerType.startsWith("class<")) {
			return "class";
		}
		if (lowerType.startsWith("array<")) {
			return "array";
		}
		return type;
	}

	public getComment(): string {
		return this.comment;
	}

	public getDescription(): string {
		return this.description;
	}

	public declaration(): string {
		return `${this.getModifiers()}${this.name};${this.comment ? ` // ${this.comment}` : ""}`;
	}

	public getName(): string {
		return this.name;
	}

	public getLineNumber(): number {
		return this.lineNumber;
	}

	public getFileName(): string {
		return this.fileName;
	}

	public insertDynamicSnippet(view: vscode.TextEditor): void {
		this.createDynamicTooltip(view);
		const snippet = new vscode.SnippetString(this.name);
		view.insertSnippet(snippet);
	}

	public createDynamicTooltip(view: vscode.TextEditor): void {
		const documentation = this.description.trim() || this.declaration();
		printToPanel(view, documentation);
	}
}
