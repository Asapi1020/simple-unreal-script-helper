import * as vscode from "vscode";
import type { SymbolEntity } from "./SymbolEntity";
import { printToPanel } from "./data";

export class UnrealFunction implements SymbolEntity {
	private modifiers: string;
	private returnType: string;
	private name: string;
	private arguments: string;
	private lineNumber: number;
	private fileName: string;
	private description: string;
	private isFunction: boolean;

	constructor(
		modifiers: string,
		returnType: string,
		name: string,
		args: string,
		lineNumber: number,
		fileName: string,
		description: string,
		isFunction: boolean,
	) {
		this.modifiers = modifiers;
		this.returnType = returnType;
		this.name = name;
		this.arguments = args;
		this.lineNumber = lineNumber;
		this.fileName = fileName;
		this.description = description;
		this.isFunction = isFunction;
	}

	public getModifiers(): string {
		return this.modifiers ? `${this.modifiers} ` : "";
	}

	public getReturnType(isPretty = false): string {
		return isPretty && this.returnType ? `${this.returnType} ` : "";
	}

	public getName(isPretty = false): string {
		return isPretty ? ` ${this.name}` : this.name;
	}

	public declaration(): string {
		return `${this.getModifiers()}${this.isFunction ? "function" : "event"}${this.getReturnType(true)}${this.getName(true)}(${this.getArguments()})`;
	}

	public getArguments(): string {
		return this.arguments;
	}

	public getLineNumber(): number {
		return this.lineNumber;
	}

	public getFileName(): string {
		return this.fileName;
	}

	public getDescription(): string {
		return this.description;
	}

	public documentation(): string {
		return this.description
			.split("\n")
			.filter((line) => {
				const trimmed = line.trimStart();
				return (
					trimmed !== "" && (trimmed.startsWith("/") || trimmed.startsWith("*"))
				);
			})
			.join("\n");
	}

	public insertDynamicSnippet(view: vscode.TextEditor): void {
		this.createDynamicTooltip(view);

		const position = view.selection.active;
		const isBeginningOfLine = position.character === 0;

		if (isBeginningOfLine) {
			const lessArguments =
				this.arguments.trim() !== ""
					? this.arguments
							.split(",")
							.map((arg) => arg.trim().split(/\s+/).pop())
							.join(", ")
					: "";
			const snippet = new vscode.SnippetString(
				`${this.getModifiers()}${this.isFunction ? "function" : "event"}${this.getReturnType(true)} ${this.name}(${this.arguments}) {
				  \${2:super.${this.name}(${lessArguments});}
				  \${3:///}
				}`,
			);
			view.insertSnippet(snippet, position);
		} else {
			const argumentsSnippet = this.arguments
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s !== "")
				.map((arg, i) => {
					return `\${${i + 1}:${arg}}`;
				})
				.join(", ");

			const snippet = new vscode.SnippetString(
				`${this.name}(${argumentsSnippet})`,
			);
			view.insertSnippet(snippet, position);
		}
	}

	public createDynamicTooltip(view: vscode.TextEditor): void {
		printToPanel(view, this.description);
	}
}
