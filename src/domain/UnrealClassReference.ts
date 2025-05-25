import * as vscode from "vscode";
import type { ClassMembers } from "./ClassMembers";
import type { VariableBase } from "./SymbolEntity";
import type { UnrealConst } from "./UnrealConst";
import type { UnrealFunction } from "./UnrealFunction";
import type { UnrealStruct } from "./UnrealStruct";
import type { UnrealVariable } from "./UnrealVariable";
import { printToPanel } from "./data";

export class ClassReference {
	private name: string;
	private description: string;
	private fileName: string;
	private parentClassName: string;

	private childrenClasses: ClassReference[] = [];
	private functions: UnrealFunction[] = [];
	private variables: UnrealVariable[] = [];
	private consts: UnrealConst[] = [];
	private structs: UnrealStruct[] = [];
	private bWasParsed = false;
	private isParsing = false;
	private parentClass: ClassReference | null = null;

	constructor(name: string, parentClassName: string, description: string, fileName: string) {
		this.name = name;
		this.description = description;
		this.fileName = fileName;
		this.parentClassName = parentClassName;
	}

	public getDescription(): string {
		return this.description;
	}

	public getName(): string {
		return this.name;
	}

	public getLineNumber(): number {
		return 1;
	}

	public getFileName(): string {
		return this.fileName;
	}

	public linkToParent(parent: ClassReference): void {
		this.parentClass = parent;
		if (this.parentClass) {
			this.parentClass.setChild(this);
		}
	}

	public setChild(child: ClassReference): void {
		this.childrenClasses.push(child);
	}

	public removeChild(child: ClassReference): void {
		this.childrenClasses = this.childrenClasses.filter((c) => c !== child);
	}

	public getChildren(): ClassReference[] {
		return this.childrenClasses;
	}

	public getAllChildrenClasses(): string[] {
		const allChildren: string[] = [];
		for (const child of this.childrenClasses) {
			allChildren.push(...child.getAllChildrenClasses());
		}
		return [this.getName(), ...allChildren];
	}

	public getParent(): ClassReference | null {
		return this.parentClass;
	}

	public getParentClass(): string {
		return this.parentClassName;
	}

	public hasParsed(): boolean {
		return this.bWasParsed;
	}

	public isParsingProgress(): boolean {
		return this.isParsing;
	}

	public saveCompletions(members: ClassMembers): void {
		this.functions = members.functions;
		this.variables = members.variables;
		this.consts = members.consts;
		this.structs = members.structs;
		this.bWasParsed = true;
	}

	public clear(): void {
		this.functions = [];
		this.variables = [];
		this.consts = [];
		this.structs = [];
		this.bWasParsed = false;
	}

	public getFunctions(): UnrealFunction[] {
		return this.functions;
	}

	public getFunction(name: string): UnrealFunction | null {
		for (const func of this.functions) {
			if (name.toLowerCase() === func.getName().toLowerCase()) {
				return func;
			}
		}
		return this.parentClass?.getFunction(name) ?? null;
	}

	public getVariables(): VariableBase[] {
		return [...this.variables, ...this.consts, ...this.structs];
	}

	public getVariable(name: string): UnrealVariable | null {
		for (const variable of this.variables) {
			if (name.toLowerCase() === variable.getName().toLowerCase()) {
				return variable;
			}
		}

		return this.parentClass?.getVariable(name) ?? null;
	}

	public updateClass(newParent: ClassReference, description: string): void {
		const parent = this.getParent();
		if (parent) {
			parent.removeChild(this);
		}
		this.parentClassName = newParent.getName();
		this.description = description;
		this.linkToParent(newParent);
	}

	public insertDynamicSnippet(view: vscode.TextEditor): void {
		this.createDynamicTooltip(view);
		const snippet = new vscode.SnippetString(this.name);
		view.insertSnippet(snippet);
	}

	public createDynamicTooltip(view: vscode.TextEditor): void {
		const documentation = this.description;
		printToPanel(view, documentation);
	}
}
