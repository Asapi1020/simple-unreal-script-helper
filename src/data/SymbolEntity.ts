import type * as vscode from "vscode";
import type { ClassesCollector } from "../parser/ClassesCollector";

export interface SymbolEntity {
	getDescription(): string;
	getName(): string;
	getLineNumber(): number;
	getFileName(): string;
	insertDynamicSnippet(view: vscode.TextEditor): void;
	createDynamicTooltip(view: vscode.TextEditor): void;
}

export interface VariableBase extends SymbolEntity {
	getModifiers(): string;
	getType(secondaryLevel?: number, newType?: string): string;
	getComment(): string;
	declaration(): string;
}

export interface SerializableClass extends SymbolEntity {
	name: string;
	parentClassName: string;
	description: string;
	fileName: string;
	setCollectorReference(collector: ClassesCollector): void;
}
