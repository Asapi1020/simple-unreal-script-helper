import * as vscode from "vscode";

export class VSCode {
	public extensionPath: string;

	constructor(extensionPath: string) {
		this.extensionPath = extensionPath;
	}

	public showInfoMessage(message: string): void {
		vscode.window.showInformationMessage(message);
		console.log("showInfoMessage", message);
	}

	public setStatusBarMessage(message: string, timeout: number): void {
		vscode.window.setStatusBarMessage(message, timeout);
		console.log("setStatusBarMessage", message, timeout);
	}

	public getActiveTextEditor(): vscode.TextEditor | undefined {
		return vscode.window.activeTextEditor;
	}

	public getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
		return vscode.workspace.workspaceFolders;
	}

	public getActiveFileName(): string | undefined {
		const editor = this.getActiveTextEditor();
		return editor?.document.fileName;
	}

	public executeCommand(command: string, ...args: unknown[]): Thenable<unknown> {
		return vscode.commands.executeCommand(command, ...args);
	}
}
