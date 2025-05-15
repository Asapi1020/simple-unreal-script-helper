import * as vscode from "vscode";
import type { VariableBase } from "./SymbolEntity";
import type { UnrealVariable } from "./UnrealVariable";
import { printToPanel } from "./data";

export class UnrealStruct implements VariableBase {
	private name: string;
	private description: string;
	private fileName: string;
	private lineNumber: number;
	private structLine: string;
	private variables: UnrealVariable[] = [];

	constructor(
		name: string,
		structLine: string,
		lineNumber: number,
		fileName: string,
		description: string,
	) {
		this.name = name;
		this.description = description;
		this.fileName = fileName;
		this.lineNumber = lineNumber;
		this.structLine = structLine;
	}

	public getDescription(): string {
		return this.description;
	}

	public declaration(): string {
		return this.structLine;
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

	public getModifiers(): string {
		return "";
	}

	public getType(): string {
		return this.name;
	}

	public getComment(): string {
		return "";
	}

	public saveVariables(variables: UnrealVariable[]): void {
		this.variables = variables;
	}

	public getVariables(): UnrealVariable[] {
		return this.variables;
	}

	public getVariable(name: string): UnrealVariable | undefined {
		for (const variable of this.variables) {
			if (variable.getName().toLowerCase() === name.toLowerCase()) {
				return variable;
			}
		}
		return undefined;
	}

	public insertDynamicSnippet(view: vscode.TextEditor): void {
		this.createDynamicTooltip(view);
		const snippet = new vscode.SnippetString(this.name);
		view.insertSnippet(snippet);
	}

	public createDynamicTooltip(view: vscode.TextEditor): void {
		const documentation = `${this.description}\n${this.structLine}`;
		printToPanel(view, documentation);
	}
}
