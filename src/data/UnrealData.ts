import * as vscode from "vscode";
import type { SymbolEntity, VariableBase } from "./SymbolEntity";
import { ClassReference } from "./UnrealClassReference";
import { UnrealFunction } from "./UnrealFunction";
import { UnrealStruct } from "./UnrealStruct";
import { UnrealVariable } from "./UnrealVariable";

export type AssetEntry = [string, string]; // [ClassName, AssetName]

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

export type ObjectData = { entity: SymbolEntity; num?: number };

export class UnrealData {
	private classes: ClassReference[] = [];

	private completionsForFile: Completion[] = [];
	private fileNames: string[] = [];
	private functions: UnrealFunction[] = [];
	private variables: VariableBase[] = [];

	public completionClass: ClassReference | null = null;

	private inbuiltFunctions: UnrealFunction[] = [];
	private inbuiltVariables: VariableBase[] = [];

	private assets: AssetEntry[] | null = null;

	public addClass(
		className: string,
		parentClass: string,
		description: string,
		fileName: string,
	): ClassReference | undefined {
		if (!this.getClass(className)) {
			const classReference = new ClassReference(
				className,
				parentClass,
				description,
				fileName,
				this,
			);
			this.classes.push(classReference);
			return classReference;
		}
	}

	public linkClasses(): void {
		for (const classReference of this.classes) {
			classReference.linkToParent();
		}
	}

	public getObject(
		word: string,
		data: SymbolEntity | UnrealData,
		options: GetObjectOptions,
	): ObjectData | null {
		const outOf = data ?? this;
		const [num, keyWord] = word.trim().endsWith("]")
			? [(word.match(/\[/g) || []).length, word.split("[")[0]]
			: [0, word];

		if (outOf instanceof UnrealStruct) {
			const variable = outOf.getVariable(keyWord);
			return variable ? { entity: variable } : null;
		}

		if (!options.hasNoClasses && outOf instanceof UnrealData) {
			const classReference = outOf.getClass(keyWord);
			if (classReference) {
				return {
					entity: classReference,
					num: options.isSecondType ? num : undefined,
				};
			}
		}

		if (
			!options.hasNoFunctions &&
			(outOf instanceof UnrealData || outOf instanceof ClassReference)
		) {
			const functionReference = outOf.getFunction(keyWord);
			if (functionReference) {
				return {
					entity: functionReference,
					num: options.isSecondType ? num : undefined,
				};
			}
		}

		if (
			!options.hasNoVariables &&
			(outOf instanceof UnrealData || outOf instanceof ClassReference)
		) {
			const variableReference = outOf.getVariable(keyWord);
			if (variableReference) {
				return {
					entity: variableReference,
					num: options.isSecondType ? num : undefined,
				};
			}
		}

		if (options.localVariables && options.localVariables.length > 0) {
			const local = options.localVariables.filter(
				(variable) =>
					variable.getName().toLowerCase() === keyWord.toLowerCase(),
			);
			if (local.length > 0) {
				return {
					entity: local[0],
					num: options.isSecondType ? num : undefined,
				};
			}
		}

		if (outOf instanceof ClassReference && outOf.hasParsed()) {
			console.log(
				`class ${outOf.getName()} not parsed yet, parse class now...`,
			);
			return null;
		}
		return null;
	}

	public getClassFromContext(
		line: string,
		fromClass?: ClassReference,
		localVariables: UnrealVariable[] = [],
	): ClassReference | null {
		const objects = line.slice(0, -1).split(".");
		console.log(line);
		console.log(objects, fromClass?.getName() ?? "");

		if (objects.length === 1) {
			if (line.endsWith("self.")) {
				const activeEditor = vscode.window.activeTextEditor;
				const activeFile = activeEditor?.document.fileName;
				return this.getClassFromFileName(activeFile);
			}

			if (line.endsWith("super.")) {
				const activeEditor = vscode.window.activeTextEditor;
				const activeFile = activeEditor?.document.fileName;
				return this.getClassFromFileName(activeFile)?.getParent() ?? null;
			}

			if (line.endsWith(").")) {
				if (line.includes("super(")) {
					const className = line.split("(").at(-1)?.slice(0, -2) ?? "";
					return this.getClass(className) ?? null;
				}

				const objectWord = line.split("(")[0];
				const object = this.getObject(objectWord, fromClass ?? this, {
					isSecondType: true,
				});
				if (!object) {
					return null;
				}

				const type = this.getObjectType(object, fromClass);
				if (!type || type instanceof ClassReference) {
					return type;
				}
				return this.getClassFromContext(
					`${type.getName()}.`,
					fromClass,
					localVariables,
				);
			}

			const objectWord = line.slice(0, -1);
			const object = this.getObject(objectWord, fromClass ?? this, {
				hasNoClasses: true,
				isSecondType: true,
				localVariables: fromClass ? undefined : localVariables,
			});
			if (!object) {
				return null;
			}
			const type = this.getObjectType(object, fromClass);
			if (!type || type instanceof ClassReference) {
				return type;
			}
			return this.getClassFromContext(
				`${type.getName()}.`,
				fromClass,
				localVariables,
			);
		}

		const classReference = this.getClassFromContext(
			`${objects[0]}.`,
			fromClass,
			localVariables,
		);
		if (classReference) {
			return this.getClassFromContext(
				`${objects.slice(1).join(".")}.`,
				classReference,
			);
		}
		return null;
	}

	public getObjectType(
		object: ObjectData,
		itsClass?: ClassReference,
	): SymbolEntity | null {
		const { entity } = object;
		if (entity instanceof ClassReference) {
			return entity;
		}

		const typeName =
			entity instanceof UnrealFunction
				? entity.getReturnType()
				: entity instanceof UnrealVariable
					? entity.getType()
					: undefined;

		if (!typeName) {
			console.log(`obj ${entity?.getName() ?? "Unknown"} has no type!`);
			return null;
		}

		console.log(`object type: ${typeName}`);
		const classReference = this.getClass(typeName);
		if (classReference) {
			return classReference;
		}

		if (itsClass) {
			return this.getObject(typeName, itsClass, {})?.entity ?? null;
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

	public getClassFromFileName(
		fileName: string | undefined,
	): ClassReference | null {
		if (!fileName) {
			return null;
		}
		for (const classReference of this.classes) {
			if (classReference.getFileName() === fileName) {
				return classReference;
			}
		}
		return null;
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

		const completionIndex = this.completionsForFile.findIndex(
			(completion) => completion.fileName === fileName,
		);
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
			const { variables, functions, isParsing } = this.getCompletionsFromClass(
				options.fromClass,
			);
			if (isParsing) {
				return ["parsing..."];
			}
			this.completionClass = options.fromClass;
			return this.filterRelevantItems(functions, variables, options);
		}
		if (this.inbuiltFunctions.length === 0) {
			const hiddenClass = this.getClass("HiddenFunctions");
			if (hiddenClass) {
				const completion = this.getCompletionsFromClass(hiddenClass);
				this.inbuiltFunctions = completion.isParsing
					? []
					: completion.functions;
				this.inbuiltVariables = completion.isParsing
					? []
					: completion.variables;
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
					.filter((variable) =>
						variable
							.getName()
							.toLowerCase()
							.includes(options.word.toLowerCase()),
					)
					.map((variable) => {
						return `${variable.getName()}\t${variable.getModifiers()}${variable.getName()}`;
					});
		const functionCompletions = options.hasNoFunctions
			? []
			: functions
					.filter((func) =>
						func.getName().toLowerCase().includes(options.word.toLowerCase()),
					)
					.map((func) => {
						return `${func.getName()}\t(${func.getArguments()})`;
					});
		const classCompletions = options.hasNoClasses
			? []
			: this.classes
					.filter((classReference) =>
						classReference
							.getName()
							.toLowerCase()
							.includes(options.word.toLowerCase()),
					)
					.map((classReference) => {
						return `${classReference.getName()}\tClass${classReference.getName()}`;
					});

		const localVariableCompletions = options.localVariables
			? options.localVariables.map((variable) => {
					return `${variable.getName()}\t${variable.getModifiers()}${variable.getName()}`;
				})
			: [];

		return [
			...variableCompletions,
			...functionCompletions,
			...classCompletions,
			...localVariableCompletions,
		];
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

		const classReference =
			entity instanceof ClassReference
				? entity
				: this.getClassFromFileName(entity.getFileName());

		if (classReference) {
			if (classReference.hasParsed()) {
				const { functions, message: functionMessage } =
					this.getFunctionsFromClass(classReference);
				const { variables, message: variableMessage } =
					this.getVariablesFromClass(classReference);
				return {
					fileName: entity.getFileName(),
					functions,
					variables,
					functionMessage,
					variableMessage,
				};
			}

			classReference.parseMe();
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

	public getFunctionsFromClass(classReference: ClassReference): {
		functions: UnrealFunction[];
		message: string;
	} {
		const functions = classReference.getFunctions();
		const message = `### ${classReference.getName()}\t-    Functions ###`;
		const parentClass = classReference.getParent();
		return {
			functions: parentClass
				? [...functions, ...this.getFunctionsFromClass(parentClass).functions]
				: functions,
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
			variables: parentClass
				? [...variables, ...this.getVariablesFromClass(parentClass).variables]
				: variables,
			message,
		};
	}

	public saveCompletionsToFile(fileName: string): void {
		if (
			!this.completionsForFile.some(
				(completion) => completion.fileName === fileName,
			)
		) {
			this.completionsForFile.push({
				fileName,
				functions: this.functions,
				variables: this.variables,
			});
		}
	}

	public loadCompletionsForFile(fileName: string): void {
		const completion = this.completionsForFile.find(
			(completion) => completion.fileName === fileName,
		);
		if (completion) {
			this.functions = completion.functions;
			this.variables = completion.variables;
		}
	}
}
