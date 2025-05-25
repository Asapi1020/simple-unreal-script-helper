import type { SymbolEntity } from "../domain/SymbolEntity";
import { ClassReference } from "../domain/UnrealClassReference";
import { UnrealConst } from "../domain/UnrealConst";
import { UnrealFunction } from "../domain/UnrealFunction";
import { UnrealStruct } from "../domain/UnrealStruct";
import { UnrealVariable } from "../domain/UnrealVariable";
import {
	formatClass,
	formatConst,
	formatFunction,
	formatStruct,
	formatVariable,
} from "../domain/definition/hoverFormat";
import { endsWithOperator, isFunctionOrEvent, isInBracketVariable } from "../domain/parser/parser";
import type { UnrealData } from "../infra/UnrealData";
import type { Context } from "./Context";

interface DefinitionTarget {
	file: string;
	line: number;
	character: number;
}

export class DefinitionUsecase {
	private context: Context;

	constructor(context: Context) {
		this.context = context;
	}

	private get unrealData(): UnrealData {
		return this.context.infra.unrealData;
	}

	public resolveTarget(leftLine: string, word: string, activeFile: string): DefinitionTarget | null {
		const target = this.findDefinition(leftLine, word, activeFile);
		return target
			? {
					file: target.getFileName(),
					line: target.getLineNumber(),
					character: 0,
				}
			: null;
	}

	public resolveHoverText(leftLine: string, word: string, activeFile: string): string | null {
		const definition = this.findDefinition(leftLine, word, activeFile);
		if (!definition) {
			return null;
		}
		if (definition instanceof ClassReference) {
			return formatClass(definition);
		}
		if (definition instanceof UnrealFunction) {
			return formatFunction(definition);
		}
		if (definition instanceof UnrealVariable) {
			return formatVariable(definition);
		}
		if (definition instanceof UnrealConst) {
			return formatConst(definition);
		}
		if (definition instanceof UnrealStruct) {
			return formatStruct(definition);
		}
		return null;
	}

	private findDefinition(leftLine: string, word: string, activeFile: string): SymbolEntity | null {
		const thisClass = this.unrealData.getClassFromFileName(activeFile);
		if (!thisClass) {
			console.warn("active class is null", activeFile);
			return null;
		}

		if (isFunctionOrEvent(leftLine) || leftLine.toLowerCase().endsWith("super.")) {
			return this.getFunctionOrEventDefInAncestors(word, thisClass);
		}

		if (
			leftLine === "" ||
			leftLine.toLowerCase() === "foreach" ||
			isInBracketVariable(leftLine) ||
			endsWithOperator(leftLine)
		) {
			const objectDef = this.getObjectDefFromClass(word, thisClass);
			if (objectDef) {
				return objectDef;
			}
		}

		if (leftLine.toLowerCase().endsWith("self.")) {
			const objectDef = this.unrealData.getObject(word, thisClass, {
				hasNoClasses: true,
			});
			return objectDef;
		}

		if (leftLine.endsWith(".")) {
			const contextString = this.extractContextString(leftLine);
			const contextClass = this.unrealData.getClassFromContext(contextString, thisClass);
			if (contextClass) {
				return this.unrealData.getObject(word, contextClass, {
					hasNoClasses: true,
				});
			}
			return null;
		}

		if (leftLine.toLowerCase().endsWith("class'")) {
			const objectDef = this.unrealData.getObject(word, this.unrealData, {
				hasNoFunctions: true,
				hasNoVariables: true,
			});
			if (objectDef) {
				return objectDef;
			}
		}

		console.debug("case not handled for: ", leftLine);
		return null;
	}

	private extractContextString(line: string): string {
		const operatorMatch = [...line.matchAll(/[+\-*/%&|^!<>=]/g)];
		const lastMatch = operatorMatch.at(-1);
		const operatorTrimmed = lastMatch ? line.slice(lastMatch.index + 1).trim() : line;

		const foreachMatch = operatorTrimmed.match(/foreach\s*(.*)/i);
		const foreachTrimmed = foreachMatch ? foreachMatch[1].trim() : operatorTrimmed;
		const staticTrimmed = foreachTrimmed.replace(/static\./gi, "");
		return staticTrimmed;
	}

	private getFunctionOrEventDefInAncestors(name: string, thisClass: ClassReference): SymbolEntity | null {
		let parentClass = this.unrealData.safeLoadParentOf(thisClass);
		while (parentClass) {
			const parentsObjectDef = this.unrealData.getObject(name, parentClass, {
				hasNoClasses: true,
			});
			if (parentsObjectDef) {
				return parentsObjectDef;
			}
			parentClass = this.unrealData.safeLoadParentOf(parentClass);
		}

		const classDef = this.unrealData.getObject(name, this.unrealData, {
			hasNoFunctions: true,
			hasNoVariables: true,
		});
		return classDef;
	}

	private getObjectDefFromClass(objectName: string, fromClass: ClassReference): SymbolEntity | null {
		switch (objectName.toLowerCase()) {
			case "super": {
				const parentClass = this.unrealData.safeLoadParentOf(fromClass);
				return parentClass ? this.unrealData.getObject(parentClass.getName(), this.unrealData) : null;
			}
			case "self": {
				const className = fromClass.getName();
				return className ? this.unrealData.getObject(className, this.unrealData) : null;
			}
			default:
				return (
					this.unrealData.getObject(objectName, fromClass) ?? this.unrealData.getObject(objectName, this.unrealData)
				);
		}
	}
}
