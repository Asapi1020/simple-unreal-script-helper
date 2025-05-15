import * as vscode from "vscode";
import { UnrealData } from "./data/UnrealData";
import { UnrealPlugin } from "./plugin";

export function activate(context: vscode.ExtensionContext) {
	console.debug("activate");
	vscode.window.showInformationMessage(
		"UnrealScript IDE 拡張が有効化されました",
	);

	const unrealData = new UnrealData();
	const plugin = new UnrealPlugin(context, unrealData);
	context.subscriptions.push(plugin.onPostSave());
}

export function deactivate() {}
