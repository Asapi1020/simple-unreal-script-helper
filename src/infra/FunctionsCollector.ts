import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { ClassMembers } from "../domain/ClassMembers";
import type { ClassReference } from "../domain/UnrealClassReference";
import { UnrealConst } from "../domain/UnrealConst";
import { UnrealFunction } from "../domain/UnrealFunction";
import { UnrealStruct } from "../domain/UnrealStruct";
import { UnrealVariable } from "../domain/UnrealVariable";
import type { FileSystem } from "../driver/FileSystem";
import type { Context } from "./Context";

const REGEX_FUNCTION =
	/([a-zA-Z0-9()\s]*?)function\s+((coerce)\s*)?([a-zA-Z0-9<>_]*?)\s*([a-zA-Z0-9_-]+)\s*(\(+)(.*)((\s*\))+)\s*(const)?\s*;?\s*(\/\/.*)?/;
const REGEX_EVENT =
	/([a-zA-Z0-9()\s]*?)event\s+((coerce)\s*)?([a-zA-Z0-9<>_]*?)\s*([a-zA-Z0-9_-]+)\s*(\(+)(.*)((\s*\))+)\s*(const)?\s*;?\s*(\/\/.*)?/;
const REGEX_CONST = /const\s+([a-zA-Z0-9_]+)\s*=\s*([a-zA-Z0-9"'!_\-.]+);/;

export class FunctionsCollector {
	private context: Context;

	constructor(context: Context) {
		this.context = context;
	}

	private get fileSystem(): FileSystem {
		return this.context.driver.fileSystem;
	}

	public async parseClass(classReference: ClassReference): Promise<ClassMembers | null> {
		const fileName = classReference.getFileName();
		if (classReference?.hasParsed()) {
			return null;
		}
		const members = await this.collectMembers(fileName);
		const parentClass = classReference.getParent();
		if (parentClass && parentClass.getName() !== classReference.getName()) {
			const parentsMembers = await this.parseClass(parentClass);
			if (parentsMembers) {
				members.functions = [...members.functions, ...parentsMembers.functions];
				members.variables = [...members.variables, ...parentsMembers.variables];
				members.consts = [...members.consts, ...parentsMembers.consts];
				members.structs = [...members.structs, ...parentsMembers.structs];
			}
		}
		classReference.saveCompletions(members);
		return members;
	}

	private async collectMembers(fileName: string): Promise<ClassMembers> {
		const encoding = this.fileSystem.detectEncoding(fileName);
		const fileStream = createReadStream(fileName, { encoding });
		const rl = createInterface({ input: fileStream });

		let currentDocumentation = "";
		let isCppText = false;
		let cppTextBracketsNum = 0;
		let isStruct = false;
		let isBracketOnSameLine = true;
		let longLine = "";
		let index = -1;
		let isFail = false;
		const functions: UnrealFunction[] = [];
		const structs: UnrealStruct[] = [];
		const variables: UnrealVariable[] = [];
		const consts: UnrealConst[] = [];
		const currentStructVariables: UnrealVariable[] = [];

		for await (const line of rl) {
			index += 1;
			const trimmedLine = line.trim();

			if (trimmedLine === "") {
				currentDocumentation = "";
				continue;
			}

			if (isCppText) {
				if (trimmedLine === "{") {
					cppTextBracketsNum += 1;
				} else if (trimmedLine === "}") {
					cppTextBracketsNum -= 1;
				}
				if (cppTextBracketsNum === 0) {
					isCppText = false;
				}
				continue;
			}
			if (trimmedLine === "cpptext") {
				isCppText = true;
				continue;
			}

			if (isStruct) {
				if (line.includes("};")) {
					isStruct = false;
					structs.at(-1)?.saveVariables(currentStructVariables);
					currentStructVariables.length = 0;
				}
				continue;
			}

			const isFirstCommentLine =
				(trimmedLine.startsWith("/*") || trimmedLine.startsWith("/")) && currentDocumentation === "";
			if (isFirstCommentLine) {
				currentDocumentation = line;
				continue;
			}
			const shouldAddComment = currentDocumentation !== "" && currentDocumentation !== line;
			if (shouldAddComment) {
				currentDocumentation += line;
			}
			const isStillCommentLine = trimmedLine.startsWith("*") || trimmedLine.startsWith("//");
			if (isStillCommentLine) {
				continue;
			}
			const leftLine = trimmedLine.split("//")[0].toLowerCase();
			if (!isBracketOnSameLine) {
				if (!leftLine.includes(")")) {
					longLine += line;
					continue;
				}
				isBracketOnSameLine = true;
				const newLine = `${longLine.trim().split(/\s+/).join(" ")})`;
				const extractedFunction = this.extractFunction(newLine, newLine, index, fileName, currentDocumentation);
				if (extractedFunction) {
					functions.push(extractedFunction);
					currentDocumentation = "";
					continue;
				}
				const complicatedFunction = this.extractComplicatedFunction(newLine, index, fileName, currentDocumentation);
				if (complicatedFunction) {
					functions.push(complicatedFunction);
				}
				currentDocumentation = "";
				continue;
			}

			const splitLeftLine = leftLine.trim().split(/\s+/);
			if (!isStruct && splitLeftLine[0] === "struct") {
				isStruct = true;
				currentStructVariables.length = 0;
				const newLine = leftLine.includes("extends") ? line.trim().split("extends")[0] : line;
				const structName = splitLeftLine.at(-1);
				if (!structName) {
					// console.warn("Failed to parse struct name:", line);
					continue;
				}
				structs.push(new UnrealStruct(structName, newLine, index, fileName, currentDocumentation));
				currentDocumentation = "";
				continue;
			}

			if (leftLine.includes("function") || leftLine.includes("event")) {
				const extractedFunction = this.extractFunction(line, leftLine, index, fileName, currentDocumentation);
				if (extractedFunction) {
					functions.push(extractedFunction);
					currentDocumentation = "";
					continue;
				}
				isFail = true;
				for (let i = 0; i < splitLeftLine.length; i++) {
					const txt = splitLeftLine[i].toLowerCase();
					if (txt === "function" || txt === "event") {
						isFail = false;

						const remaining = splitLeftLine.slice(i).join(" ");
						if (remaining.includes("(") && remaining.includes(")")) {
							// console.warn(
							// 	"Failed to parse this function/event:\n",
							// 	line,
							// 	"(it probably should fail. If you see a line that fails that shouldn't, contact me)",
							// );
							isFail = true;
						}
					}
				}

				if (!isFail) {
					isBracketOnSameLine = false;
					longLine = line;
				}
			} else if (leftLine.includes("var")) {
				const varLinesSplitByComment = line.includes("//") ? line.split("//") : line.split("/**");

				const varLinesWithoutComment = varLinesSplitByComment[0]
					.trim()
					.replace(/[\n\r\t ;]+$/, "")
					.split(/\s+/);
				if (varLinesWithoutComment.length === 0 || !varLinesWithoutComment[0].toLowerCase().includes("var")) {
					continue;
				}

				const docLine = varLinesSplitByComment.length > 1 ? varLinesSplitByComment[1].trimEnd() : "";
				const varNames: string[] = [];

				const lastToken = varLinesWithoutComment.at(-1);

				// in case there is no space between array name and type like "array<int>intList"
				if (lastToken?.includes(">")) {
					const match = lastToken.match(/^(.+?>)(\w+)$/);
					if (match) {
						const [_, type, name] = match;
						varLinesWithoutComment[varLinesWithoutComment.length - 1] = type;
						varLinesWithoutComment.push(name);
					}
				}
				const varName = varLinesWithoutComment.pop();
				if (!varName) {
					continue;
				}
				varNames.push(varName);

				const isMultipleDefinition = (varLines: string[]): boolean => {
					return varLines.length > 0 && (varLines.at(-1)?.includes(",") ?? false);
				};
				while (isMultipleDefinition(varLinesWithoutComment)) {
					const nextVar = varLinesWithoutComment.pop()?.replace(/[\n\r\t ,]+$/, "");
					if (!nextVar) {
						break;
					}
					varNames.push(nextVar);
				}

				const varModifiers = varLinesWithoutComment;
				for (const name of varNames) {
					const newVariable = new UnrealVariable(
						varModifiers,
						name.trim(),
						docLine,
						index,
						fileName,
						currentDocumentation,
					);
					if (isStruct) {
						currentStructVariables.push(newVariable);
					} else {
						variables.push(newVariable);
					}
				}

				currentDocumentation = "";
			} else if (leftLine.includes("const")) {
				const extractedConst = this.extractConst(line, index, fileName, currentDocumentation);
				if (extractedConst) {
					consts.push(extractedConst);
					currentDocumentation = "";
				} else {
					// console.warn(
					// 	"Failed to parse const:\n",
					// 	line,
					// 	"(it probably should fail. If you see a line that fails that shouldn't, contact me)",
					// );
				}
			}
		}

		return {
			functions,
			variables,
			consts,
			structs,
		};
	}

	private extractFunction(
		line: string,
		leftLine: string,
		lineIndex: number,
		fileName: string,
		currentDocumentation: string,
	): UnrealFunction | null {
		let isFunction = false;

		if (leftLine.toLowerCase().includes("function")) {
			isFunction = true;
		} else if (leftLine.toLowerCase().includes("event")) {
			isFunction = false;
		} else {
			console.log("No function or event in", leftLine.toLowerCase(), ". full line:", line);
			return null;
		}
		const regex: RegExp = isFunction ? REGEX_FUNCTION : REGEX_EVENT;

		const match = line.trim().match(regex);
		if (match) {
			const modifiers = match[1];
			const returnType = match[4];
			const functionName = match[5];
			const args = match[7];
			return new UnrealFunction(
				modifiers,
				returnType,
				functionName,
				args,
				lineIndex,
				fileName,
				currentDocumentation,
				isFunction,
			);
		}
		return null;
	}

	private extractComplicatedFunction(
		leftLine: string,
		lineIndex: number,
		fileName: string,
		currentDocumentation: string,
	): UnrealFunction | null {
		let isFunction = false;
		let newLine: string[];

		if (leftLine.toLowerCase().includes("function")) {
			newLine = leftLine.split(/function/i);
			isFunction = true;
		} else if (leftLine.toLowerCase().includes("event")) {
			newLine = leftLine.split(/event/i);
		} else {
			return null;
		}

		const keyword = isFunction ? "function" : "event";
		const remainder = newLine.at(-1)?.trim().split(" ").slice(1).join(" ");
		const reconstructedLine = `${newLine[0]} ${keyword} ${remainder}`;
		return this.extractFunction(reconstructedLine, reconstructedLine, lineIndex, fileName, currentDocumentation);
	}

	private extractConst(
		line: string,
		lineNumber: number,
		fileName: string,
		currentDocumentation: string,
	): UnrealConst | null {
		const comment = line.split("//").pop() ?? "";
		const match = REGEX_CONST.exec(line.trim());

		if (match !== null) {
			const name = match[1];
			const value = match[2];
			return new UnrealConst(name.trim(), value, currentDocumentation, comment.trim(), fileName, lineNumber);
		}

		return null;
	}
}
