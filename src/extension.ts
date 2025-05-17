import * as vscode from "vscode";
import { UnrealData } from "./data/UnrealData";
import { UnrealPlugin } from "./plugin";

export function activate(context: vscode.ExtensionContext) {
	console.debug("activated");
	vscode.window.showInformationMessage(
		"Simple UnrealScript Extension is now active!",
	);

	const unrealData = new UnrealData(context);
	const plugin = new UnrealPlugin(context, unrealData);
	context.subscriptions.push(plugin.onPostSave());
	context.subscriptions.push(plugin.onActivated());
	context.subscriptions.push(plugin.onCompletion());
}

export function deactivate() {}
