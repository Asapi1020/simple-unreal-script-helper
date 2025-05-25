import * as vscode from "vscode";
import type { UnrealData } from "../infra/UnrealData";
import type { Context } from "./Context";
import { UnrealCompletionProvider } from "./UnrealCompletionProvider";
import { UnrealDefinitionProvider } from "./UnrealDefinitionProvider";

export class UnrealPlugin {
	private context: Context;

	constructor(context: Context) {
		this.context = context;
		this.context.driver.vscode.showInfoMessage("Simple UnrealScript Extension is now active!");
	}

	private get unrealData(): UnrealData {
		return this.context.infra.unrealData;
	}

	public onPostSave(): vscode.Disposable {
		return vscode.workspace.onDidSaveTextDocument((document) => {
			console.log("onDidSaveTextDocument", document.fileName);
			if (!this.isUnrealScriptFile(document)) {
				return;
			}

			const fileName = document.fileName;
			this.unrealData.removeFile(fileName);

			const editor = this.context.driver.vscode.getActiveTextEditor();
			if (editor && editor.document === document) {
				this.context.usecase.activeUsecase.activated();
			}
		});
	}

	public onActivated(): vscode.Disposable {
		const editor = this.context.driver.vscode.getActiveTextEditor();
		if (editor) {
			if (this.isUnrealScriptFile(editor.document)) {
				this.context.usecase.activeUsecase.activated();
			}
		}
		return vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				this.context.usecase.activeUsecase.activated();
			}
		});
	}

	public onCompletion(): vscode.Disposable {
		return vscode.languages.registerCompletionItemProvider(
			{ language: "UnrealScript", pattern: "**/*.uc" },
			new UnrealCompletionProvider(this.context),
			".",
			" ",
			"\t",
		);
	}

	public onGoToDefinition(): vscode.Disposable {
		const provider = new UnrealDefinitionProvider(this.context);
		return vscode.languages.registerDefinitionProvider({ language: "UnrealScript", pattern: "**/*.uc" }, provider);
	}

	private isUnrealScriptFile(document: vscode.TextDocument): boolean {
		return document.languageId === "UnrealScript" || document.fileName.endsWith(".uc");
	}
}
