import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type * as vscode from "vscode";
import type { SerializableClass } from "../data/SymbolEntity";
import { ClassReference } from "../data/UnrealClassReference";

export class ClassesCollector {
	private collectorThreads: Promise<void>[] = [];
	private classes: ClassReference[] = [];
	private srcFolder = "";

	constructor(
		private context: vscode.ExtensionContext,
		private filename: string,
		private openFolderArr: string[],
		private isFirst: boolean,
	) {}

	public async start(): Promise<void> {
		if (this.isFirst) {
			for (const folder of this.openFolderArr) {
				if (folder.includes("Development\\Src")) {
					console.log("src folder found:", folder);
					if (await this.cacheExists(folder)) {
						console.log("cache exists. Loading...");
						await this.loadClassesFromCache();
					} else {
						console.log("no cache. parsing...");
						await this.getClasses(folder);
						await this.getInbuiltClasses();
					}
					break;
				}
			}
		} else {
			if (this.filename) {
				await this.saveClasses(this.filename);
			}
		}

		await Promise.all(this.collectorThreads);
		console.debug("classes: ", this.classes.length);
	}

	public getClass(className: string): ClassReference | null {
		return this.classes.find((c) => c.getName() === className) ?? null;
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

	private async getClasses(path: string): Promise<void> {
		const entries = await fs.promises.readdir(path, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = `${path}/${entry.name}`;
			if (entry.isFile() && entry.name.endsWith(".uc")) {
				const thread = this.saveClasses(fullPath);
				this.collectorThreads.push(thread);
			} else if (entry.isDirectory()) {
				await this.getClasses(fullPath);
			}
		}
	}

	private async getInbuiltClasses(): Promise<void> {
		const inbuilt = ["Array", "Class", "HiddenFunctions"];
		for (const name of inbuilt) {
			const filePath = path.join(
				this.context.extensionPath,
				"src",
				"in-built-classes",
				`${name}.uc`,
			);
			const thread = this.saveClasses(filePath);
			this.collectorThreads.push(thread);
		}
	}

	private async saveClasses(filename: string): Promise<void> {
		let description = "";
		const inbuiltClasses = ["Array", "Class", "HiddenFunctions"];
		const lines = (await readFile(filename, "utf-8")).split(/\r?\n/);

		for (const line of lines) {
			description += `${line}\n`;

			const match = description.match(/class\s+\w+\s+extends\s+(\w+)/i);
			if (match) {
				const parentClass = match[1].toLowerCase();
				const className = path.basename(filename).split(".")[0];
				this.addClass(className, parentClass, description, filename);
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
					const className = path.basename(filename).split(".")[0];
					this.addClass(className, "", description, filename);
					break;
				}
			}
		}
	}

	private async cacheExists(folder: string): Promise<boolean> {
		const cachePath = `${folder}/classes_cache.json`;
		return fs.promises
			.access(cachePath)
			.then(() => true)
			.catch(() => false);
	}

	private async loadClassesFromCache(): Promise<void> {
		const path = `${this.srcFolder}/classes_cache.json`;
		try {
			await fs.promises.access(path);

			const json = await fs.promises.readFile(path, "utf-8");
			const rawClasses: SerializableClass[] = JSON.parse(json);

			this.classes = rawClasses.map((raw) => {
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

			console.log("Classes loaded from cache.");
		} catch (err) {
			console.warn("No cache found or error loading:", err);
		}
	}
}
