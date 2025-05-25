import * as vscode from "vscode";
import type { VariableBase } from "./SymbolEntity";
import { printToPanel } from "./data";

export class UnrealConst implements VariableBase {
	private name: string;
	private value: string;
	private description: string;
	private comment: string;
	private fileName: string;
	private lineNumber: number;

	constructor(name: string, value: string, description: string, comment: string, fileName: string, lineNumber: number) {
		this.name = name;
		this.value = value;
		this.description = description;
		this.comment = comment;
		this.fileName = fileName;
		this.lineNumber = lineNumber;
	}

	public getType(): string {
		return "";
	}

	public getValue(): string {
		return this.value;
	}

	public getModifiers(): string {
		return `CONST = ${this.value}`;
	}

	public getComment(): string {
		return this.comment.trim() ? `    // ${this.comment}` : "";
	}

	public getDescription(): string {
		return this.description;
	}

	public getName(): string {
		return this.name.trim();
	}

	public declaration(): string {
		return this.description;
	}

	public getLineNumber(): number {
		return this.lineNumber;
	}

	public getFileName(): string {
		return this.fileName;
	}

	public insertDynamicSnippet(view: vscode.TextEditor): void {
		view.insertSnippet(new vscode.SnippetString(this.name));
	}

	public createDynamicTooltip(view: vscode.TextEditor): void {
		const documentation = `const ${this.getName()} = ${this.getValue()};${this.getComment()}`;
		printToPanel(view, documentation);
	}
}
