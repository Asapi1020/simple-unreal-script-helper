import * as vscode from "vscode";
import type { UnrealData } from "../data/UnrealData";
import type { ClassesCollector } from "../parser/ClassesCollector";
import { FunctionsCollector } from "../parser/FunctionsCollector";
import { UnrealCompletionProvider } from "../parser/UnrealCompletionProvider";
import { UnrealDefinitionProvider } from "./UnrealDefinitionProvider";

export function isUnrealScriptFile(document: vscode.TextDocument): boolean {
	return document.languageId === "UnrealScript" || document.fileName.endsWith(".uc");
}

export class UnrealPlugin {
	private unrealData: UnrealData;
	private isBuiltForCurrentFile = false;
	private isFirstTime = true;
	private isStillParsingClasses = true;
	private isWantedToGoToDefinition = false;
	private isWantedToAutocomplete = false;
	private fileNames: string[] = [];

	constructor(
		private context: vscode.ExtensionContext,
		private collector: ClassesCollector,
		unrealData: UnrealData,
	) {
		this.unrealData = unrealData;
	}

	public onPostSave(): vscode.Disposable {
		return vscode.workspace.onDidSaveTextDocument((document) => {
			console.log("onDidSaveTextDocument", document.fileName);
			if (!isUnrealScriptFile(document)) {
				return;
			}

			const fileName = document.fileName;
			this.unrealData.removeFile(fileName);

			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document === document) {
				this.activated(editor);
			}
		});
	}

	public onActivated(): vscode.Disposable {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			this.activated(editor);
		}
		return vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				this.activated(editor);
			}
		});
	}

	public onCompletion(): vscode.Disposable {
		return vscode.languages.registerCompletionItemProvider(
			{ language: "UnrealScript", pattern: "**/*.uc" },
			new UnrealCompletionProvider(this.unrealData),
			".",
			" ",
			"\t",
		);
	}

	public onGoToDefinition(): vscode.Disposable {
		const provider = new UnrealDefinitionProvider(this.unrealData);
		return vscode.languages.registerDefinitionProvider({ language: "UnrealScript", pattern: "**/*.uc" }, provider);
	}

	private async activated(editor: vscode.TextEditor): Promise<void> {
		if (!isUnrealScriptFile(editor.document)) {
			return;
		}

		this.isBuiltForCurrentFile = true;

		if (this.isFirstTime) {
			this.isFirstTime = false;
			vscode.window.setStatusBarMessage("UnrealScriptAutocomplete: startup: start parsing classes...", 5000);
			console.log("startup: start parsing classes...");

			const folders = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath);
			this.handleClassesCollector(editor, "", folders);
			return;
		}

		const fileName = editor.document.fileName;
		if (!this.isStillParsingClasses && fileName && !this.fileNames.includes(fileName)) {
			console.log("start parsing file:", fileName);
			this.handleClassesCollector(editor, fileName, []);
			this.fileNames.push(fileName);
			this.handleFunctionsCollector(fileName);
			return;
		}

		console.log("already parsed, load completions for file:", fileName);
		//this.loadCompletionsForFile(fileName);
	}

	private async handleClassesCollector(
		editor: vscode.TextEditor,
		fileName?: string,
		openFolderArr?: string[],
	): Promise<void> {
		await this.collector.start({
			extensionPath: this.context.extensionPath,
			fileName,
			openFolderArr,
		});
		this.unrealData.addClasses(this.collector.returnClasses());
		this.handleCollector(editor);
	}

	private async handleFunctionsCollector(fileName: string): Promise<void> {
		const collector = new FunctionsCollector(fileName, this.collector);
		await collector.start();
		const properties = collector.returnProperties();
		this.unrealData.addFunctions(properties.functions);
		this.unrealData.addVariables([
			...properties.variables,
			...properties.consts,
			...properties.structs,
			...properties.structVariables,
		]);
	}

	private async handleCollector(editor: vscode.TextEditor): Promise<void> {
		if (this.isStillParsingClasses) {
			console.log("Finished parsing classes, start parsing current file");
			this.isStillParsingClasses = false;
			this.unrealData.linkClasses();
			this.activated(editor);
		} else if (this.isWantedToGoToDefinition) {
			console.log("wanted to go to definition!");
			this.isWantedToGoToDefinition = false;
			await vscode.commands.executeCommand("editor.action.revealDefinition");
		} else if (this.isWantedToAutocomplete) {
			console.log("wanted to auto-complete!");
			this.isWantedToAutocomplete = false;
			await vscode.commands.executeCommand("hideSuggestWidget");
			await vscode.commands.executeCommand("editor.action.triggerSuggest");
		} else if (this.isBuiltForCurrentFile) {
			this.isBuiltForCurrentFile = false;
			const classReference = this.unrealData.getClassFromFileName(editor.document.fileName);
			if (!classReference) {
				console.warn("classReference is null");
				return;
			}
			this.unrealData.setCompletionsFromClass(classReference);
			this.unrealData.saveCompletionsToFile(editor.document.fileName);
		}
	}
}
