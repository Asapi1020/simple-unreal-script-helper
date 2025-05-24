import * as vscode from "vscode";
import type { ClassesCollector } from "../parser/ClassesCollector";
import { FunctionsCollector } from "../parser/FunctionsCollector";
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
	private collectorReference: ClassesCollector;

	private childrenClasses: ClassReference[] = [];
	private functions: UnrealFunction[] = [];
	private variables: UnrealVariable[] = [];
	private consts: UnrealConst[] = [];
	private structs: UnrealStruct[] = [];
	private bWasParsed = false;
	private isParsing = false;
	private parentClass: ClassReference | null = null;

	constructor(
		name: string,
		parentClassName: string,
		description: string,
		fileName: string,
		collectorReference: ClassesCollector,
	) {
		this.name = name;
		this.description = description;
		this.fileName = fileName;
		this.parentClassName = parentClassName;
		this.collectorReference = collectorReference;
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

	public linkToParent(): void {
		if (this.parentClassName) {
			this.parentClass = this.collectorReference.getClass(this.parentClassName) ?? null;
			if (this.parentClass) {
				this.parentClass.setChild(this);
			}
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

	public safeLoadParent(): ClassReference | null {
		if (!this.parentClass) {
			this.linkToParent();
		}
		return this.parentClass;
	}

	public getParentClass(): string {
		return this.parentClassName;
	}

	public hasParsed(): boolean {
		return this.bWasParsed;
	}

	public saveCompletions(
		functions: UnrealFunction[],
		variables: UnrealVariable[],
		consts: UnrealConst[],
		structs: UnrealStruct[],
	): void {
		this.functions = functions;
		this.variables = variables;
		this.consts = consts;
		this.structs = structs;
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
		if (!this.bWasParsed) {
			this.parseMeRecursively();
			return null;
		}
		for (const func of this.functions) {
			if (name.toLowerCase() === func.getName().toLowerCase()) {
				return func;
			}
		}
		const parentClass = this.collectorReference.getClass(this.parentClassName);
		return parentClass?.getFunction(name) ?? null;
	}

	public getVariables(): VariableBase[] {
		return [...this.variables, ...this.consts, ...this.structs];
	}

	public getVariable(name: string): UnrealVariable | null {
		if (!this.bWasParsed) {
			this.parseMeRecursively();
			return null;
		}
		for (const variable of this.variables) {
			if (name.toLowerCase() === variable.getName().toLowerCase()) {
				return variable;
			}
		}

		const parentClass = this.collectorReference.getClass(this.parentClassName);
		return parentClass?.getVariable(name) ?? null;
	}

	public setCollectorReference(collectorReference: ClassesCollector): void {
		this.collectorReference = collectorReference;
	}

	public updateClass(parentClassName: string, description: string): void {
		const parent = this.getParent();
		if (parent) {
			parent.removeChild(this);
		}
		this.parentClassName = parentClassName;
		this.description = description;
		this.linkToParent();
	}

	public async parseMe(): Promise<void> {
		if (this.isParsing) {
			return;
		}
		const collector = new FunctionsCollector(this.fileName, this.collectorReference);
		this.isParsing = true;
		await collector.start();
		this.isParsing = false;
		const properties = collector.returnProperties();
		this.functions = properties.functions;
		this.variables = properties.variables;
		this.consts = properties.consts;
		this.structs = properties.structs;
		this.bWasParsed = true;
	}

	public async parseMeRecursively(): Promise<void> {
		await this.parseMe();
		await this.parentClass?.parseMeRecursively();
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
