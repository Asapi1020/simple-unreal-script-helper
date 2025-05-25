import * as vscode from "vscode";
import type { SymbolEntity, VariableBase } from "../domain/SymbolEntity";
import { ClassReference } from "../domain/UnrealClassReference";
import { UnrealFunction } from "../domain/UnrealFunction";
import { UnrealStruct } from "../domain/UnrealStruct";
import { UnrealVariable } from "../domain/UnrealVariable";
import { extractUnclosedBracketContent } from "../parser/parser";
import type { Context } from "./Context";

export interface GetObjectOptions {
	hasNoClasses?: boolean;
	hasNoFunctions?: boolean;
	hasNoVariables?: boolean;
	isSecondType?: boolean;
	localVariables?: UnrealVariable[];
}

export interface GetAutoCompleteListOptions {
	word: string;
	hasNoClasses?: boolean;
	hasNoFunctions?: boolean;
	hasNoVariables?: boolean;
	fromClass?: ClassReference;
	localVariables?: UnrealVariable[];
}

export interface Completion {
	fileName: string;
	functions: UnrealFunction[];
	variables: VariableBase[];
	functionMessage?: string;
	variableMessage?: string;
	isParsing?: boolean;
}

export class UnrealData {
	private context: Context;
	private classes: ClassReference[] = [];
	private completionsForFile: Completion[] = [];
	private fileNames: string[] = [];
	private functions: UnrealFunction[] = [];
	private variables: VariableBase[] = [];

	private inbuiltFunctions: UnrealFunction[] = [];
	private inbuiltVariables: VariableBase[] = [];

	constructor(context: Context) {
		this.context = context;
	}

	public linkClasses(classes: ClassReference[]): void {
		for (const classReference of classes) {
			const parentClassName = classReference.getParentClass();
			const parentClass = this.getClass(parentClassName);
			if (parentClass) {
				classReference.linkToParent(parentClass);
			}
		}
	}

	public getObject(word: string, outOf: SymbolEntity | UnrealData, options: GetObjectOptions): SymbolEntity | null {
		const isArray = word.trim().endsWith("]");
		const keyWord = isArray ? word.split("[")[0] : word;

		if (outOf instanceof UnrealStruct) {
			return this.getVariableFromStruct(keyWord, outOf);
		}

		if (outOf instanceof UnrealData) {
			const object = this.getObjectFromData(keyWord, outOf, options);
			if (object) {
				return object;
			}
		}

		if (outOf instanceof ClassReference) {
			const object = this.getObjectFromClass(keyWord, outOf, options);
			if (object) {
				return object;
			}
		}

		if (options.localVariables && options.localVariables.length > 0) {
			const local = options.localVariables.find(
				(variable) => variable.getName().toLowerCase() === keyWord.toLowerCase(),
			);
			if (local) {
				return local;
			}
		}

		return null;
	}

	public getObjectFromData(word: string, data: UnrealData, options: GetObjectOptions): SymbolEntity | null {
		console.debug(`get object '${word}' from data with`, options);
		if (!options.hasNoClasses) {
			const classReference = data.getClass(word);
			if (classReference) {
				return classReference;
			}
		}

		if (!options.hasNoFunctions) {
			const functionReference = data.getFunction(word);
			if (functionReference) {
				return functionReference;
			}
		}

		if (!options.hasNoVariables) {
			const variableReference = data.getVariable(word);
			if (variableReference) {
				return variableReference;
			}
		}

		return null;
	}

	public getObjectFromClass(word: string, fromClass: ClassReference, options: GetObjectOptions): SymbolEntity | null {
		console.debug(`get object '${word}' from class'${fromClass.getName()}' with`, options);
		if (!fromClass.hasParsed()) {
			console.log(`class'${fromClass.getName()}' not parsed yet.`);
			return null;
		}
		if (!options.hasNoFunctions) {
			const functionReference = fromClass.getFunction(word);
			if (functionReference) {
				return functionReference;
			}
		}
		if (!options.hasNoVariables) {
			const variableReference = fromClass.getVariable(word);
			if (variableReference) {
				return variableReference;
			}
		}
		return null;
	}

	public getVariableFromStruct(word: string, fromStruct: UnrealStruct): UnrealVariable | null {
		console.debug(`get variable '${word}' from struct ${fromStruct.getName()}`);
		const variable = fromStruct.getVariable(word);
		return variable ?? null;
	}

	public getClassFromContext(
		line: string,
		fromClass?: ClassReference,
		localVariables: UnrealVariable[] = [],
	): ClassReference | null {
		const objectWord =
			extractUnclosedBracketContent(line.slice(0, -1).split("{").pop() || line.slice(0, -1)) || line.slice(0, -1);
		const objects = objectWord.split(".");
		if (objects.length === 1) {
			if (line.toLowerCase().endsWith("self.")) {
				return this.getActiveClass();
			}

			if (line.toLowerCase().endsWith("super.")) {
				return this.getActiveClass()?.getParent() ?? null;
			}

			if (line.endsWith(").")) {
				if (line.includes("super(")) {
					const className = line.split("(").at(-1)?.slice(0, -2) ?? "";
					return this.getClass(className) ?? null;
				}

				const preBracket = line.split("(")[0];
				const object = fromClass
					? (this.getObject(preBracket, fromClass, {
							isSecondType: true,
						}) ??
						this.getObject(preBracket, this, {
							isSecondType: true,
						}))
					: this.getObject(preBracket, this, {
							isSecondType: true,
						});
				if (!object) {
					return null;
				}

				const isArray = objectWord.trim().endsWith("]");
				const type = this.getObjectType(object, fromClass, isArray ? 1 : 0);
				if (!type || type instanceof ClassReference) {
					return type;
				}
				return this.getClassFromContext(`${type.getName()}.`, fromClass, localVariables);
			}

			const classMatch = line.match(/class'([^']+)'\.$/i);
			if (classMatch) {
				const className = classMatch[1];
				const classReference = this.getClass(className);
				if (classReference) {
					return classReference;
				}
			}
			const object = this.getObject(objectWord, fromClass ?? this, {
				hasNoClasses: true,
				isSecondType: true,
				localVariables: fromClass ? undefined : localVariables,
			});
			if (!object) {
				return null;
			}
			const isArray = objectWord.trim().endsWith("]");
			const objectType = this.getObjectType(object, fromClass, isArray ? 1 : 0);
			if (!objectType || objectType instanceof ClassReference) {
				return objectType;
			}
			return this.getClassFromContext(`${objectType.getName()}.`, fromClass, localVariables);
		}

		const classReference = this.getClassFromContext(`${objects[0]}.`, fromClass, localVariables);
		if (classReference) {
			return this.getClassFromContext(`${objects.slice(1).join(".")}.`, classReference);
		}
		return null;
	}

	public getObjectType(entity: SymbolEntity, itsClass?: ClassReference, secondaryLevel?: number): SymbolEntity | null {
		if (entity instanceof ClassReference) {
			return entity;
		}

		const typeName =
			entity instanceof UnrealFunction
				? entity.getReturnType()
				: entity instanceof UnrealVariable
					? entity.getType(secondaryLevel)
					: undefined;

		if (!typeName) {
			console.log(`obj ${entity?.getName() ?? "Unknown"} has no type!`);
			return null;
		}

		const classReference = this.getClass(typeName);
		if (classReference) {
			return classReference;
		}

		if (itsClass) {
			return this.getObject(typeName, itsClass, {}) ?? null;
		}
		return null;
	}

	public getClass(className: string): ClassReference | null {
		for (const classReference of this.classes) {
			if (classReference.getName().toLowerCase() === className.toLowerCase()) {
				return classReference;
			}
		}
		return null;
	}

	public getClassFromFileName(fileName: string | undefined): ClassReference | null {
		if (!fileName) {
			return null;
		}
		for (const classReference of this.classes) {
			if (classReference.getFileName().toLowerCase() === fileName.toLowerCase()) {
				return classReference;
			}
		}
		return null;
	}

	public getActiveClass(): ClassReference | null {
		const activeEditor = vscode.window.activeTextEditor;
		const activeFile = activeEditor?.document.fileName;
		if (!activeFile) {
			return null;
		}
		return this.getClassFromFileName(activeFile);
	}

	public getClasses(): ClassReference[] {
		return this.classes;
	}

	public getFunction(functionName: string): UnrealFunction | null {
		for (const func of [...this.functions, ...this.inbuiltFunctions]) {
			if (func.getName().toLowerCase() === functionName.toLowerCase()) {
				return func;
			}
		}
		return null;
	}

	public getVariable(variableName: string): VariableBase | null {
		for (const variable of [...this.variables, ...this.inbuiltVariables]) {
			if (variable.getName().toLowerCase() === variableName.toLowerCase()) {
				return variable;
			}
		}
		return null;
	}

	public removeFile(fileName: string): void {
		const fileIndex = this.fileNames.indexOf(fileName);
		if (fileIndex !== -1) {
			this.fileNames.splice(fileIndex, 1);
		}

		const completionIndex = this.completionsForFile.findIndex((completion) => completion.fileName === fileName);
		if (completionIndex !== -1) {
			this.completionsForFile.splice(completionIndex, 1);
		}

		const classReference = this.getClassFromFileName(fileName);
		if (classReference) {
			classReference.clear();
		}
	}

	public getAutoCompleteList(options: GetAutoCompleteListOptions): string[] {
		if (options.fromClass) {
			const { variables, functions, isParsing } = this.getCompletionsFromClass(options.fromClass);
			if (isParsing) {
				return ["parsing..."];
			}
			return this.filterRelevantItems(functions, variables, options);
		}
		if (this.inbuiltFunctions.length === 0) {
			const hiddenClass = this.getClass("HiddenFunctions");
			if (hiddenClass) {
				const completion = this.getCompletionsFromClass(hiddenClass);
				this.inbuiltFunctions = completion.isParsing ? [] : completion.functions;
				this.inbuiltVariables = completion.isParsing ? [] : completion.variables;
			}
		}
		return this.filterRelevantItems(
			[...this.functions, ...this.inbuiltFunctions],
			[...this.variables, ...this.inbuiltVariables],
			options,
		);
	}
	private filterRelevantItems(
		functions: UnrealFunction[],
		variables: VariableBase[],
		options: GetAutoCompleteListOptions,
	): string[] {
		const variableCompletions = options.hasNoVariables
			? []
			: variables
					.filter((variable) => variable.getName().toLowerCase().includes(options.word.toLowerCase()))
					.map((variable) => {
						return `${variable.getName()}\t${variable.getModifiers()}${variable.getName()}`;
					});
		const functionCompletions = options.hasNoFunctions
			? []
			: functions
					.filter((func) => func.getName().toLowerCase().includes(options.word.toLowerCase()))
					.map((func) => {
						return `${func.getName()}\t(${func.getArguments()})`;
					});
		const classCompletions = options.hasNoClasses
			? []
			: this.classes
					.filter((classReference) => classReference.getName().toLowerCase().includes(options.word.toLowerCase()))
					.map((classReference) => {
						return classReference.getName();
					});

		const localVariableCompletions = options.localVariables
			? options.localVariables.map((variable) => {
					return `${variable.getName()}\t${variable.getModifiers()}${variable.getName()}`;
				})
			: [];

		return [...variableCompletions, ...functionCompletions, ...classCompletions, ...localVariableCompletions];
	}

	public getCompletionsFromClass(entity: SymbolEntity): Completion {
		if (entity instanceof UnrealStruct) {
			return {
				fileName: entity.getFileName(),
				functions: [],
				variables: [],
				functionMessage: "",
				variableMessage: `### ${entity.getName()}\t-    Variables ###${entity.getVariables()}`,
			};
		}

		const classReference = entity instanceof ClassReference ? entity : this.getClassFromFileName(entity.getFileName());

		if (classReference) {
			if (classReference.hasParsed()) {
				const { functions, message: functionMessage } = this.getFunctionsFromClass(classReference);
				const { variables, message: variableMessage } = this.getVariablesFromClass(classReference);
				return {
					fileName: entity.getFileName(),
					functions,
					variables,
					functionMessage,
					variableMessage,
				};
			}
			return {
				fileName: entity.getFileName(),
				functions: [],
				variables: [],
				isParsing: true,
			};
		}
		console.log(`No class found for ${entity.getFileName()}`);
		return {
			fileName: entity.getFileName(),
			functions: [],
			variables: [],
			isParsing: true,
		};
	}

	private setCompletionsFromClass(entity: SymbolEntity): void {
		const completion = this.getCompletionsFromClass(entity);
		this.functions = completion.functions;
		this.variables = completion.variables;
	}

	public getFunctionsFromClass(classReference: ClassReference): {
		functions: UnrealFunction[];
		message: string;
	} {
		const functions = classReference.getFunctions();
		const message = `### ${classReference.getName()}\t-    Functions ###`;
		const parentClass = classReference.getParent();
		return {
			functions: parentClass ? [...functions, ...this.getFunctionsFromClass(parentClass).functions] : functions,
			message,
		};
	}

	public getVariablesFromClass(classReference: ClassReference): {
		variables: VariableBase[];
		message: string;
	} {
		const variables = classReference.getVariables();
		const message = `### ${classReference.getName()}\t-    Variables ###`;
		const parentClass = classReference.getParent();
		return {
			variables: parentClass ? [...variables, ...this.getVariablesFromClass(parentClass).variables] : variables,
			message,
		};
	}

	private saveCompletionsToFile(fileName: string): void {
		if (!this.completionsForFile.some((completion) => completion.fileName === fileName)) {
			this.completionsForFile.push({
				fileName,
				functions: this.functions,
				variables: this.variables,
			});
		}
	}

	public loadCompletionsForFile(fileName: string): void {
		const completion = this.completionsForFile.find((completion) => completion.fileName === fileName);
		if (completion) {
			this.functions = completion.functions;
			this.variables = completion.variables;
		}
	}

	public addClasses(classes: ClassReference[]): void {
		const newClasses = classes.filter(
			(classReference) => !this.classes.some((existingClass) => existingClass.getName() === classReference.getName()),
		);
		this.classes.push(...newClasses);
		console.debug(`Added ${newClasses.length} classes to UnrealData. Now ${this.classes.length} classes.`);

		this.linkClasses(newClasses);
		for (const classReference of newClasses) {
			this.setCompletionsFromClass(classReference);
			this.saveCompletionsToFile(classReference.getFileName());
		}
	}

	public safeLoadParentOf(classReference: ClassReference): ClassReference | null {
		const parent = classReference.getParent();
		if (parent) {
			return parent;
		}
		const parentClassName = classReference.getParentClass();
		const parentClass = this.getClass(parentClassName);
		if (parentClass) {
			classReference.linkToParent(parentClass);
			return parentClass;
		}
		return null;
	}

	public parseClass(classReference: ClassReference): void {
		if (classReference.isParsingProgress()) {
			return;
		}
	}

	public addFunctions(functions: UnrealFunction[]): void {
		const newFunctions = functions.filter(
			(func) => !this.functions.some((existingFunction) => existingFunction.getName() === func.getName()),
		);
		this.functions.push(...newFunctions);
		console.debug(`Added ${newFunctions.length} functions to UnrealData. Now ${this.functions.length} functions.`);
	}

	public addVariables(variables: VariableBase[]): void {
		const newVariables = variables.filter(
			(variable) => !this.variables.some((existingVariable) => existingVariable.getName() === variable.getName()),
		);
		this.variables.push(...newVariables);
		console.debug(`Added ${newVariables.length} variables to UnrealData. Now ${this.variables.length} variables.`);
	}
}
