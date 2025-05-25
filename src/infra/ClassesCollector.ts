import path from "node:path";
import { ClassReference } from "../domain/UnrealClassReference";
import type { FileSystem } from "../driver/FileSystem";
import type { VSCode } from "../driver/VSCode";
import type { Context } from "./Context";
import { toRawText } from "./interface-adapter/Controller";
import { toSerializableClasses } from "./interface-adapter/Presenter";

export interface CollectorOptions {
	fileName?: string;
	extensionPath?: string;
	openFolderArr?: string[];
}

export class ClassesCollector {
	private context: Context;
	private srcFolder = "";

	constructor(context: Context) {
		this.context = context;
	}

	private get vscode(): VSCode {
		return this.context.driver.vscode;
	}

	private get fileSystem(): FileSystem {
		return this.context.driver.fileSystem;
	}

	private get classesCachePath(): string {
		return path.join(this.srcFolder, "classes_cache.json");
	}

	public collectInFolders(folders: string[]): ClassReference[] {
		this.srcFolder = folders.find((folder) => folder.includes("Development\\Src")) ?? "";
		if (this.cacheExists()) {
			this.vscode.setStatusBarMessage("cache exists. Loading...", 5000);
			const cacheClasses = this.loadClassesFromCache();
			return cacheClasses;
		}
		this.vscode.setStatusBarMessage("no cache. parsing...", 5000);
		const classes: ClassReference[] = [];
		for (const folder of folders) {
			console.log("parsing classes from:", folder);
			classes.push(...this.collectClasses(folder));
		}
		classes.push(...this.getInbuiltClasses());
		return classes;
	}

	public collectInFile(fileName: string): ClassReference | null {
		return this.spawnClass(fileName);
	}

	public saveClassesToCache(classes: ClassReference[]): void {
		if (this.srcFolder) {
			console.debug(`Saving ${classes.length} classes to cache...`);
			const json = toRawText(classes);
			this.fileSystem.writeFile(this.classesCachePath, json, "utf-8");
			console.log("Classes saved to cache.", this.classesCachePath);
		} else {
			console.warn("Source folder is not set. Cannot save classes to cache.");
		}
	}

	private collectClasses(dirPath: string): ClassReference[] {
		const entries = this.fileSystem.readDir(dirPath);
		const classes: ClassReference[] = [];

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			if (entry.isFile() && entry.name.endsWith(".uc")) {
				const classReference = this.spawnClass(fullPath);
				if (classReference) {
					classes.push(classReference);
				}
			} else if (entry.isDirectory()) {
				classes.push(...this.collectClasses(fullPath));
			}
		}

		return classes;
	}

	private getInbuiltClasses(): ClassReference[] {
		const inbuilt = ["Array", "Class", "HiddenFunctions"];
		const classes: ClassReference[] = [];
		for (const name of inbuilt) {
			const filePath = path.join(this.context.driver.vscode.extensionPath, "src", "in-built-classes", `${name}.uc`);
			const classReference = this.spawnClass(filePath);
			if (classReference) {
				classes.push(classReference);
			}
		}
		return classes;
	}

	private spawnClass(fileName: string): ClassReference | null {
		let description = "";
		const inbuiltClasses = ["Array", "Class", "HiddenFunctions"];
		const encoding = this.fileSystem.detectEncoding(fileName);
		const lines = this.fileSystem.readFile(fileName, encoding).split(/\r?\n/);

		for (const line of lines) {
			description += `${line}\n`;

			const match = description.match(/class\s+\w+\s+extends\s+(\w+)/i);
			if (match) {
				const parentClass = match[1];
				const className = path.basename(fileName).split(".")[0];
				return new ClassReference(className, parentClass, description, fileName);
			}

			const isComment = line.trim().startsWith("*") || line.trim().startsWith("/");
			if (!isComment) {
				const lowerCaseLine = line.toLowerCase();
				const isInBuiltClass =
					inbuiltClasses.some((className) => lowerCaseLine.includes(`class ${className.toLowerCase()}`)) ||
					lowerCaseLine.includes("class object");
				if (isInBuiltClass) {
					const className = path.basename(fileName).split(".")[0];
					return new ClassReference(className, "", description, fileName);
				}
			}
		}
		return null;
	}

	private cacheExists(): boolean {
		return this.fileSystem.exists(this.classesCachePath);
	}

	private loadClassesFromCache(): ClassReference[] {
		const encoding = this.fileSystem.detectEncoding(this.classesCachePath);
		const rawText = this.fileSystem.readFile(this.classesCachePath, encoding);
		const rawClasses = toSerializableClasses(rawText);
		const cacheClasses = rawClasses.map((raw) => {
			const classReference = new ClassReference(raw.name, raw.parentClassName, raw.description, raw.fileName);
			return classReference;
		});
		console.log("Classes loaded from cache.");
		return cacheClasses;
	}
}
