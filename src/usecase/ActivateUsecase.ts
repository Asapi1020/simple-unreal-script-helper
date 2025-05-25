import type { ClassReference } from "../domain/UnrealClassReference";
import type { VSCode } from "../driver/VSCode";
import type { UnrealData } from "../infra/UnrealData";
import type { Context } from "./Context";

export class ActivateUsecase {
	private context: Context;
	private isFirstTime = true;
	private collectedFileNames: string[] = [];

	constructor(context: Context) {
		this.context = context;
	}

	private get vscode(): VSCode {
		return this.context.driver.vscode;
	}

	private get unrealData(): UnrealData {
		return this.context.infra.unrealData;
	}

	public activated(): void {
		const classes: ClassReference[] = [];
		this.vscode.setStatusBarMessage("UnrealScript: start parsing classes...", 5000);
		if (this.isFirstTime) {
			this.isFirstTime = false;
			const folders = this.vscode.getWorkspaceFolders()?.map((folder) => folder.uri.fsPath);
			if (folders) {
				classes.push(...this.collectClassesInFolders(folders));
			} else {
				console.warn("No workspace folders found");
			}
		}

		const fileName = this.vscode.getActiveFileName();
		if (fileName) {
			const classReference = this.collectClassesInFile(fileName);
			if (classReference) {
				classes.unshift(classReference);
			}
		}
		this.unrealData.addClasses(classes);
		for (const cls of classes) {
			if (!cls.hasParsed()) {
				this.context.infra.functionsCollector.parseClass(cls);
			}
		}
		this.context.infra.classesCollector.saveClassesToCache(this.unrealData.getClasses());
		this.vscode.setStatusBarMessage("Finished parsing classes", 5000);
	}

	private collectClassesInFolders(folders: string[]): ClassReference[] {
		const classes = this.context.infra.classesCollector.collectInFolders(folders);
		const fileNames = classes.map((cls) => cls.getFileName());
		this.collectedFileNames.push(...fileNames);
		return classes;
	}

	private collectClassesInFile(fileName: string): ClassReference | null {
		if (this.collectedFileNames.includes(fileName)) {
			return null;
		}
		const classReference = this.context.infra.classesCollector.collectInFile(fileName);
		if (classReference) {
			this.collectedFileNames.push(fileName);
		}
		return classReference;
	}
}
