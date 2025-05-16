import * as vscode from "vscode";
import type { ClassReference } from "../data/UnrealClassReference";
import type { GetObjectOptions, UnrealData } from "../data/UnrealData";
import { ClassesCollector } from "../parser/ClassesCollector";
import { EventManager } from "./EventManager";

export function isUnrealScriptFile(document: vscode.TextDocument): boolean {
	return (
		document.languageId === "unrealscript" || document.fileName.endsWith(".uc")
	);
}

export class UnrealPlugin {
	private unrealData: UnrealData;
	private isBuiltForCurrentFile = false;
	private isFirstTime = true;
	private isStillParsingClasses = true;
	private isWantedToGoToDefinition = false;
	private isWantedToAutocomplete = false;

	private eventManager: EventManager | null = null;
	private fileNames: string[] = [];

	constructor(
		private context: vscode.ExtensionContext,
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
				this.onActivated(editor);
			}
		});
	}

	private async onActivated(editor: vscode.TextEditor): Promise<void> {
		if (!isUnrealScriptFile(editor.document)) {
			return;
		}

		this.unrealData.clearCompletionClass();
		this.isBuiltForCurrentFile = true;

		if (this.isFirstTime) {
			this.isFirstTime = false;
			this.eventManager = new EventManager();
			this.eventManager.goToDefinition.handle(this.onGoToDefinition.bind(this));
			// this.eventManager.rebuildCache.handle(this.onRebuildCache.bind(this));
			// this.eventManager.getClassReference.handle(
			// 	this.onGetClassReference.bind(this),
			// );
			// this.eventManager.getAndOpenObject.handle(
			// 	this.onGetAndOpenObject.bind(this),
			// );

			vscode.window.setStatusBarMessage(
				"UnrealScriptAutocomplete: startup: start parsing classes...",
				5000,
			);
			console.log("startup: start parsing classes...");

			const folders = vscode.workspace.workspaceFolders?.map(
				(folder) => folder.uri.fsPath,
			);
			const collector = new ClassesCollector(
				this.context,
				"",
				folders ?? [],
				true,
			);
			this.handleThreads(editor, collector);
			return;
		}

		const fileName = editor.document.fileName;
		if (
			!this.isStillParsingClasses &&
			fileName &&
			!this.fileNames.includes(fileName)
		) {
			console.log("start parsing file:", fileName);
			this.fileNames.push(fileName);
			this.addFunctionCollectorThread(fileName);
			return;
		}

		console.log("already parsed, load completions for file:", fileName);
		//this.loadCompletionsForFile(fileName);
	}

	private onGoToDefinition(
		leftLine: string,
		word: string,
		fullLine: string,
	): void {
		const window = vscode.window;
		const editor = window.activeTextEditor;
		if (!editor) return;

		const activeFile = editor.document.fileName;

		if (
			fullLine.includes("function") ||
			fullLine.includes("event") ||
			leftLine.endsWith("super.")
		) {
			const success = this.getAndOpenObject(word, this.unrealData, window, {
				hasNoFunctions: true,
				hasNoVariables: true,
			});

			if (!success) {
				const parentClass = this.unrealData
					.getClassFromFileName(activeFile)
					?.getParent();
				if (parentClass) {
					this.getAndOpenObject(word, parentClass, window, {
						hasNoClasses: true,
					});
				}
			}
			return;
		}

		if (leftLine === "" || leftLine.endsWith("self.")) {
			switch (word) {
				case "super": {
					const parentClass = this.unrealData
						.getClassFromFileName(activeFile)
						?.getParent();
					if (parentClass) {
						this.getAndOpenObject(
							parentClass.getName(),
							this.unrealData,
							window,
						);
					}
					return;
				}
				case "self": {
					const className = this.unrealData
						.getClassFromFileName(activeFile)
						?.getName();
					if (className) {
						this.getAndOpenObject(className, this.unrealData, window);
					}
					return;
				}
				default: {
					this.getAndOpenObject(word, this.unrealData, window);
					return;
				}
			}
		}

		if (leftLine.endsWith(".")) {
			const contextClass = this.unrealData.getClassFromContext(leftLine);
			if (contextClass) {
				this.getAndOpenObject(word, contextClass, window, {
					hasNoClasses: true,
				});
			} else {
				window.setStatusBarMessage("just a moment...");
				console.log("still parsing...");
			}
			return;
		}

		console.warn("case not handled!!!", leftLine);
	}

	private getAndOpenObject(
		word: string,
		outOf: ClassReference | UnrealData,
		window: typeof vscode.window,
		options: GetObjectOptions = {},
	): boolean {
		const object = this.unrealData.getObject(word, outOf, options);

		if (object) {
			const uri = vscode.Uri.file(object.entity.getFileName());
			const position = new vscode.Position(object.entity.getLineNumber(), 0);

			vscode.workspace.openTextDocument(uri).then((doc) => {
				window.showTextDocument(doc, { preview: false }).then((editor) => {
					const range = new vscode.Range(position, position);
					editor.selection = new vscode.Selection(position, position);
					editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
				});
			});

			return true;
		}
		window.setStatusBarMessage("Just a moment...");
		return false;
	}

	private async addFunctionCollectorThread(fileName: string): Promise<void> {
		const collector = new ClassesCollector(this.context, fileName, [], false);
		await collector.start();
	}

	private async handleThreads(
		editor: vscode.TextEditor,
		collector: ClassesCollector,
	): Promise<void> {
		await collector.start();

		if (this.isStillParsingClasses) {
			console.log("Finished parsing classes, start parsing current file");
			this.isStillParsingClasses = false;
			this.unrealData.linkClasses();
			this.onActivated(editor);
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
			const classReference = this.unrealData.getClassFromFileName(
				editor.document.fileName,
			);
			if (!classReference) {
				console.warn("classReference is null");
				return;
			}
			this.unrealData.setCompletionsFromClass(classReference);
			this.unrealData.saveCompletionsToFile(editor.document.fileName);
		}
	}
}
