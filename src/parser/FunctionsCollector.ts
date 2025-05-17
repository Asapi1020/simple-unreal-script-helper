import { createReadStream, promises, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type * as vscode from "vscode";
import type { ClassReference } from "../data/UnrealClassReference";
import { UnrealConst } from "../data/UnrealConst";
import { UnrealFunction } from "../data/UnrealFunction";
import { UnrealStruct } from "../data/UnrealStruct";
import { UnrealVariable } from "../data/UnrealVariable";
import { ClassesCollector } from "./ClassesCollector";

export class FunctionsCollector {
	private functions: UnrealFunction[] = [];
	private variables: UnrealVariable[] = [];
	private consts: UnrealConst[] = [];
	private structs: UnrealStruct[] = [];
	private structVariables: UnrealVariable[] = [];
	private classesCollector: ClassesCollector;

	constructor(private fileName: string) {
		this.classesCollector = new ClassesCollector(fileName, [], false);
	}

	public async start(): Promise<void> {
		if (this.fileName) {
			const classReference = this.classesCollector.getClass(this.fileName);
			if (classReference?.hasParsed()) {
				console.log("already parsed: ", this.fileName);
				return;
			}
			if (!classReference) {
				this.updateClass(null);
			}
			console.log("not parsed yet: ", this.fileName);
			this.updateClass(classReference);
			await this.saveFunctions(this.fileName);
			const parentClassName = classReference?.getParentClass();
			const parentFileName = parentClassName
				? this.getFileName(parentClassName)
				: null;
			if (parentFileName) {
				const parentFunctionsCollector = new FunctionsCollector(parentFileName);
				await parentFunctionsCollector.start();
				const parentProperties = parentFunctionsCollector.returnProperties();
				this.functions = [...this.functions, ...parentProperties.functions];
				this.variables = [...this.variables, ...parentProperties.variables];
				this.consts = [...this.consts, ...parentProperties.consts];
				this.structs = [...this.structs, ...parentProperties.structs];
				this.structVariables = [
					...this.structVariables,
					...parentProperties.structVariables,
				];
			}
			classReference?.saveCompletions(
				this.functions,
				this.variables,
				this.consts,
				this.structs,
			);
		}
	}

	public returnProperties(): {
		functions: UnrealFunction[];
		variables: UnrealVariable[];
		consts: UnrealConst[];
		structs: UnrealStruct[];
		structVariables: UnrealVariable[];
	} {
		return {
			functions: this.functions,
			variables: this.variables,
			consts: this.consts,
			structs: this.structs,
			structVariables: this.structVariables,
		};
	}

	private updateClass(classReference: ClassReference | null): void {
		const description = (() => {
			try {
				return readFileSync(this.fileName, { encoding: "utf8" });
			} catch (error) {
				console.error("Error reading file:", error);
				return null;
			}
		})();

		if (!description) {
			return;
		}

		const classMatch = description.match(/class\s+.+?\s+extends\s+(\w+)/i);
		if (!classMatch) {
			return;
		}

		const parentClassName = classMatch[1].toLowerCase();

		if (classReference) {
			if (
				classReference.getParentClass() !== parentClassName ||
				classReference.getDescription() !== description
			) {
				classReference.updateClass(parentClassName, description);
			}
		} else {
			const className = path.basename(this.fileName).split(".")[0];
			const newClass = this.classesCollector.addClass(
				className,
				parentClassName,
				description,
				this.fileName,
			);
			newClass?.linkToParent();
		}
	}

	private addFunction(
		functionModifiers: string,
		returnType: string,
		functionName: string,
		args: string,
		lineNumber: number,
		fileName: string,
		description = "",
		isFunction = true,
	): void {
		if (functionName !== "") {
			this.functions.push(
				new UnrealFunction(
					functionModifiers.trim(),
					returnType.trim(),
					functionName.trim(),
					args.trim(),
					lineNumber + 1,
					fileName,
					description,
					isFunction,
				),
			);
		}
	}

	private addVariable(
		varModifiers: string[],
		varName: string,
		comment: string,
		lineNumber: number,
		fileName: string,
		description = "",
		isStruct = false,
	): void {
		const variable = new UnrealVariable(
			varModifiers,
			varName.trim(),
			comment,
			lineNumber + 1,
			fileName,
			description,
		);

		if (isStruct) {
			this.structVariables.push(variable);
		} else {
			this.variables.push(variable);
		}
	}

	private addConst(
		constName: string,
		value: string,
		comment: string,
		lineNumber: number,
		fileName: string,
		description = "",
	): void {
		this.consts.push(
			new UnrealConst(
				constName.trim(),
				value,
				description,
				comment,
				fileName,
				lineNumber + 1,
			),
		);
	}

	private addStruct(
		structName: string,
		value: string,
		lineNumber: number,
		fileName: string,
		description: string,
	) {
		this.structs.push(
			new UnrealStruct(structName, value, lineNumber, fileName, description),
		);
	}

	private async saveFunctions(fileName: string): Promise<void> {
		const regexFunction =
			/([a-zA-Z0-9()\s]*?)function\s+((coerce)\s*)?([a-zA-Z0-9<>_]*?)\s*([a-zA-Z0-9_-]+)\s*(\(+)(.*)((\s*\))+)\s*(const)?\s*;?\s*(\/\/.*)?/;
		const regexEvent =
			/([a-zA-Z0-9()\s]*?)event\s+((coerce)\s*)?([a-zA-Z0-9<>_]*?)\s*([a-zA-Z0-9_-]+)\s*(\(+)(.*)((\s*\))+)\s*(const)?\s*;?\s*(\/\/.*)?/;
		const regexConst = /const\s+([a-zA-Z0-9_]+)\s*=\s*([a-zA-Z0-9"'!_\-.]+);/;

		const encoding = await FunctionsCollector.detectEncoding(fileName);
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

			if (isStruct) {
				if (line.includes("};")) {
					isStruct = false;
					this.structs[this.structs.length - 1].saveVariables(
						this.structVariables,
					);
					this.structVariables = [];
				}
			}

			if (trimmedLine === "cpptext") {
				isCppText = true;
			}

			if (
				trimmedLine.startsWith("/*") ||
				(trimmedLine.startsWith("/") && currentDocumentation === "")
			) {
				currentDocumentation = line;
				continue;
			}

			if (currentDocumentation !== "" && currentDocumentation !== line) {
				currentDocumentation += line;
			}

			if (trimmedLine.startsWith("*") || trimmedLine.startsWith("//")) {
				continue;
			}
			const leftLine = trimmedLine.split("//")[0].toLowerCase();
			if (!isBracketOnSameLine) {
				if (leftLine.includes(")")) {
					isBracketOnSameLine = true;
					const newLine = `${longLine.trim().split(/\s+/).join(" ")})`;
					if (
						!this.extractFunctions(
							newLine,
							newLine,
							index,
							fileName,
							currentDocumentation,
							regexFunction,
							regexEvent,
						) &&
						!this.extractComplicatedFunction(
							newLine,
							index,
							fileName,
							currentDocumentation,
							regexFunction,
							regexEvent,
						)
					) {
						currentDocumentation = "";
						continue;
					}
				} else {
					longLine += line;
					continue;
				}
			}

			const splitLeftLine = leftLine.trim().split(/\s+/);
			if (
				!isStruct &&
				leftLine.includes("struct") &&
				splitLeftLine[0] === "struct"
			) {
				isStruct = true;
				this.structVariables = [];
				const newLine = leftLine.includes("extends")
					? line.trim().split("extends")[0]
					: line;
				const structName = splitLeftLine[splitLeftLine.length - 1];
				this.addStruct(
					structName,
					newLine,
					index,
					fileName,
					currentDocumentation,
				);
				currentDocumentation = "";
			}

			if (leftLine.includes("function") || leftLine.includes("event")) {
				if (
					this.extractFunctions(
						line,
						leftLine,
						index,
						fileName,
						currentDocumentation,
						regexFunction,
						regexEvent,
					)
				) {
					currentDocumentation = "";
				} else {
					isFail = true;
					for (let i = 0; i < splitLeftLine.length; i++) {
						const txt = splitLeftLine[i].toLowerCase();
						if (txt === "function" || txt === "event") {
							isFail = false;

							const remaining = splitLeftLine.slice(i).join(" ");
							if (remaining.includes("(") && remaining.includes(")")) {
								console.log(
									"Failed to parse this function/event:\n",
									line,
									"(it probably should fail. If you see a line that fails that shouldn't, contact me)",
								);
								isFail = true;
							}
						}
					}

					if (!isFail) {
						isBracketOnSameLine = false;
						longLine = line;
					}
				}
			} else if (leftLine.includes("var")) {
				const varDocLine = line.includes("//")
					? line.split("//")
					: line.split("/**");

				const varLine = varDocLine[0].trim().split(/\s+/);
				if (varLine.length === 0 || !varLine[0].toLowerCase().includes("var")) {
					continue;
				}

				const docLine = varDocLine.length > 1 ? varDocLine[1].trimEnd() : "";
				const varNames: string[] = [];

				const lastToken = varLine.pop()?.replace(/[\n\r\t ;]+$/, "");
				if (!lastToken) {
					continue;
				}
				varNames.push(lastToken);

				while (
					varLine.length > 0 &&
					varLine[varLine.length - 1].includes(",")
				) {
					const nextVar = varLine.pop()?.replace(/[\n\r\t ,]+$/, "");
					if (!nextVar) {
						break;
					}
					varNames.push(nextVar);
				}

				for (const rawName of varNames) {
					const formattedRawName =
						rawName.includes("<") || rawName.includes(">")
							? rawName.replace(/<.*?>/g, "")
							: rawName;
					this.addVariable(
						varLine,
						formattedRawName,
						docLine,
						index,
						fileName,
						currentDocumentation,
						isStruct,
					);
				}

				currentDocumentation = "";
			} else if (leftLine.includes("const")) {
				if (
					this.extractConst(
						line,
						index,
						fileName,
						currentDocumentation,
						regexConst,
					)
				) {
					currentDocumentation = "";
				} else {
					console.log(
						"Failed to parse const:\n",
						line,
						"(it probably should fail. If you see a line that fails that shouldn't, contact me)",
					);
				}
			}
		}
	}

	static async detectEncoding(fileName: string): Promise<"utf8" | "utf16le"> {
		const fd = await promises.open(fileName, "r");
		const buffer = Buffer.alloc(2);
		await fd.read(buffer, 0, 2, 0);
		await fd.close();

		if (buffer[0] === 0xef && buffer[1] === 0xbb) {
			return "utf8";
		}
		if (buffer[0] === 0xff && buffer[1] === 0xfe) {
			return "utf16le";
		}

		return "utf8";
	}

	private getFileName(className: string): string | null {
		const parentClass = this.classesCollector.getClass(className);
		return parentClass?.getFileName() ?? null;
	}

	private extractFunctions(
		line: string,
		leftLine: string,
		lineIndex: number,
		fileName: string,
		currentDocumentation: string,
		regexF: RegExp,
		regexE: RegExp,
	): boolean {
		let isFunction = false;

		if (leftLine.toLowerCase().includes("function")) {
			isFunction = true;
		} else if (leftLine.toLowerCase().includes("event")) {
			isFunction = false;
		} else {
			console.log(
				"No function or event in",
				leftLine.toLowerCase(),
				". full line:",
				line,
			);
			return false;
		}
		const regex: RegExp = isFunction ? regexF : regexE;

		const match = line.trim().match(regex);
		if (match) {
			this.addFunction(
				match[1], // 修飾子
				match[4], // 戻り値型
				match[5], // 関数名
				match[7], // 引数
				lineIndex,
				fileName,
				currentDocumentation,
				isFunction,
			);
			return true;
		}

		return false;
	}

	private extractComplicatedFunction(
		leftLine: string,
		lineIndex: number,
		fileName: string,
		currentDocumentation: string,
		regexF: RegExp,
		regexE: RegExp,
	): boolean {
		let isFunction = false;
		let newLine: string[];

		if (leftLine.toLowerCase().includes("function")) {
			newLine = leftLine.split(/function/i);
			isFunction = true;
		} else if (leftLine.toLowerCase().includes("event")) {
			newLine = leftLine.split(/event/i);
		} else {
			return false;
		}

		const keyword = isFunction ? "function" : "event";
		const remainder = newLine[newLine.length - 1]
			.trim()
			.split(" ")
			.slice(1)
			.join(" ");
		const reconstructedLine = `${newLine[0]} ${keyword} ${remainder}`;

		return this.extractFunctions(
			reconstructedLine,
			reconstructedLine,
			lineIndex,
			fileName,
			currentDocumentation,
			regexF,
			regexE,
		);
	}

	private extractConst(
		line: string,
		lineNumber: number,
		fileName: string,
		currentDocumentation: string,
		regexConst: RegExp,
	): boolean {
		const comment = line.split("//").pop() ?? "";
		const match = regexConst.exec(line.trim());

		if (match !== null) {
			const name = match[1];
			const value = match[2];
			this.addConst(
				name,
				value,
				comment.trim(),
				lineNumber,
				fileName,
				currentDocumentation,
			);
			return true;
		}

		return false;
	}
}
