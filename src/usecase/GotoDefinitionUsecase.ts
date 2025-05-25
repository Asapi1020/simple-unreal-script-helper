import type { ClassReference } from "../domain/UnrealClassReference";
import { endsWithOperator, isFunctionOrEvent, isInBracketVariable } from "../domain/parser/parser";
import type { GetObjectOptions, UnrealData } from "../infra/UnrealData";
import type { Context } from "./Context";

interface DefinitionTarget {
	file: string;
	line: number;
	character: number;
}

export class gotoDefinitionUsecase {
	private context: Context;

	constructor(context: Context) {
		this.context = context;
	}

	private get unrealData(): UnrealData {
		return this.context.infra.unrealData;
	}

	public resolveTarget(leftLine: string, word: string, fullLine: string, activeFile: string): DefinitionTarget | null {
		console.debug(`resolveTarget - leftLine: ${leftLine}, word: ${word}, fullLine: ${fullLine}`);

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
			const objectDef = this.getObjectDef(word, thisClass, {
				hasNoClasses: true,
			});
			return objectDef;
		}

		if (leftLine.endsWith(".")) {
			const contextString = this.extractContextString(leftLine);
			const contextClass = this.unrealData.getClassFromContext(contextString, thisClass);
			if (contextClass) {
				return this.getObjectDef(word, contextClass, {
					hasNoClasses: true,
				});
			}
			return null;
		}

		if (leftLine.toLowerCase().endsWith("class'")) {
			const objectDef = this.getObjectDef(word, this.unrealData, {
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

	private getFunctionOrEventDefInAncestors(name: string, thisClass: ClassReference): DefinitionTarget | null {
		let parentClass = this.unrealData.safeLoadParentOf(thisClass);
		while (parentClass) {
			const parentsObjectDef = this.getObjectDef(name, parentClass, {
				hasNoClasses: true,
			});
			if (parentsObjectDef) {
				return parentsObjectDef;
			}
			parentClass = this.unrealData.safeLoadParentOf(parentClass);
		}

		const classDef = this.getObjectDef(name, this.unrealData, {
			hasNoFunctions: true,
			hasNoVariables: true,
		});
		return classDef;
	}

	private getObjectDefFromClass(objectName: string, fromClass: ClassReference): DefinitionTarget | null {
		switch (objectName.toLowerCase()) {
			case "super": {
				const parentClass = this.unrealData.safeLoadParentOf(fromClass);
				return parentClass ? this.getObjectDef(parentClass.getName(), this.unrealData) : null;
			}
			case "self": {
				const className = fromClass.getName();
				return className ? this.getObjectDef(className, this.unrealData) : null;
			}
			default:
				return this.getObjectDef(objectName, fromClass) ?? this.getObjectDef(objectName, this.unrealData);
		}
	}

	private getObjectDef(
		word: string,
		outOf: ClassReference | UnrealData,
		options: GetObjectOptions = {},
	): DefinitionTarget | null {
		const object = this.unrealData.getObject(word, outOf, options);

		if (object) {
			return {
				file: object.getFileName(),
				line: object.getLineNumber(),
				character: 0,
			};
		}
		return null;
	}
}
