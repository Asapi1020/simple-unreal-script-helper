import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage(
		"UnrealScript IDE 拡張が有効化されました",
	);
}

export function deactivate() {}
