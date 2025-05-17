import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import type { SerializableClass } from "../data/SymbolEntity";
import { ClassReference } from "../data/UnrealClassReference";
import { FunctionsCollector } from "./FunctionsCollector";

export interface CollectorOptions {
	fileName?: string;
	extensionPath?: string;
	openFolderArr?: string[];
}

export class ClassesCollector {
	public activeThreads: Promise<void>[] = [];
	private classes: ClassReference[] = [];
	private srcFolder = "";

	public async start(options: CollectorOptions): Promise<void> {
		if (options.openFolderArr) {
			for (const folder of options.openFolderArr) {
				if (folder.includes("Development\\Src")) {
					this.srcFolder = folder;
					console.log("src folder found:", folder);
					if (await this.cacheExists(folder)) {
						console.log("cache exists. Loading...");
						await this.loadClassesFromCache();
					} else {
						console.log("no cache. parsing...");
						await this.getClasses(folder);
						if (options.extensionPath) {
							await this.getInbuiltClasses(options.extensionPath);
						} else {
							console.warn(
								"Extension path not provided. Skipping inbuilt classes.",
							);
						}
					}
				} else {
					console.log("dev folder found:", folder);
					await this.getClasses(folder);
				}
				await this.handleThreads();
			}
		} else if (options.fileName) {
			await this.saveClasses(options.fileName);
			await this.handleThreads();
		}
	}

	public getClass(className: string): ClassReference | null {
		return (
			this.classes.find(
				(c) => c.getName().toLowerCase() === className.toLowerCase(),
			) ?? null
		);
	}

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

	public returnClasses(): ClassReference[] {
		return this.classes;
	}

	private async getClasses(filePath: string): Promise<void> {
		const entries = await fs.promises.readdir(filePath, {
			withFileTypes: true,
		});

		for (const entry of entries) {
			const fullPath = path.join(filePath, entry.name);
			if (entry.isFile() && entry.name.endsWith(".uc")) {
				const thread = this.saveClasses(fullPath);
				this.activeThreads.push(thread);
			} else if (entry.isDirectory()) {
				await this.getClasses(fullPath);
			}
		}
	}

	private async getInbuiltClasses(extensionPath: string): Promise<void> {
		const inbuilt = ["Array", "Class", "HiddenFunctions"];
		for (const name of inbuilt) {
			const filePath = path.join(
				extensionPath,
				"src",
				"in-built-classes",
				`${name}.uc`,
			);
			const thread = this.saveClasses(filePath);
			this.activeThreads.push(thread);
		}
	}

	private async saveClasses(fileName: string): Promise<void> {
		let description = "";
		const inbuiltClasses = ["Array", "Class", "HiddenFunctions"];
		const encoding = await FunctionsCollector.detectEncoding(fileName);
		const lines = (await readFile(fileName, encoding)).split(/\r?\n/);

		for (const line of lines) {
			description += `${line}\n`;

			const match = description.match(/class\s+\w+\s+extends\s+(\w+)/i);
			if (match) {
				const parentClass = match[1].toLowerCase();
				const className = path.basename(fileName).split(".")[0];
				this.addClass(className, parentClass, description, fileName);
				break;
			}

			const isComment =
				line.trim().startsWith("*") || line.trim().startsWith("/");
			if (!isComment) {
				const classLine = line.toLowerCase();
				const matchesInbuilt =
					inbuiltClasses.some((cls) =>
						classLine.includes(`class ${cls.toLowerCase()}`),
					) || classLine.includes("class object");
				if (matchesInbuilt) {
					const className = path.basename(fileName).split(".")[0];
					this.addClass(className, "", description, fileName);
					break;
				}
			}
		}
	}

	private async cacheExists(folder: string): Promise<boolean> {
		const cachePath = `${folder}\\classes_cache.json`;
		console.log("Checking cache path:", cachePath);
		return fs.promises
			.access(cachePath)
			.then(() => true)
			.catch(() => false);
	}

	private async loadClassesFromCache(): Promise<void> {
		const path = `${this.srcFolder}\\classes_cache.json`;
		try {
			await fs.promises.access(path);

			const encoding = await FunctionsCollector.detectEncoding(path);
			const json = await fs.promises.readFile(path, encoding);
			const rawClasses: SerializableClass[] = JSON.parse(json);
			const cacheClasses = rawClasses.map((raw) => {
				const c = new ClassReference(
					raw.name,
					raw.parentClassName,
					raw.description,
					raw.fileName,
					this,
				);
				c.setCollectorReference(this);
				return c;
			});
			this.classes.push(...cacheClasses);

			console.log("Classes loaded from cache.");
		} catch (err) {
			console.warn("No cache found or error loading:", err);
		}
	}

	private async handleThreads() {
		let disposed = false;
		let disposable: vscode.Disposable | undefined;

		const showStatus = (i = 0, dir = 1) => {
			if (disposed) return;

			const before = i % 8;
			const after = 7 - before;
			const status = `UnrealScriptAutocomplete is Parsing [${" ".repeat(before)}=${" ".repeat(after)}]`;

			if (disposable) {
				disposable.dispose();
			}
			disposable = vscode.window.setStatusBarMessage(status);

			if (this.activeThreads.length > 0) {
				setTimeout(() => {
					showStatus(i + dir, before === 0 ? 1 : after === 0 ? -1 : dir);
				}, 100);
			}
		};

		showStatus();

		try {
			await Promise.all(this.activeThreads);
		} catch (error) {
			console.error("Error during parsing:", error);
		}

		disposed = true;
		if (disposable) {
			disposable.dispose();
		}

		await this.saveClassesToCache();
	}

	private async saveClassesToCache(): Promise<void> {
		if (this.srcFolder) {
			const filePath = path.join(this.srcFolder, "classes_cache.json");
			console.debug("Saving Classes: ", this.classes.length);
			const rawClasses: SerializableClass[] = this.classes.map((classRef) => {
				return {
					name: classRef.getName(),
					parentClassName: classRef.getParentClass(),
					description: classRef.getDescription(),
					fileName: classRef.getFileName(),
				};
			});
			const json = JSON.stringify(rawClasses, null, 2);
			fs.writeFileSync(filePath, json, "utf-8");
			console.log("Classes saved to cache.", filePath);
		}
	}
}
