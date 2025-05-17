import * as vscode from "vscode";
import { UnrealData } from "./data/UnrealData";
import { ClassesCollector } from "./parser/ClassesCollector";
import { UnrealPlugin } from "./plugin";

export function activate(context: vscode.ExtensionContext) {
	console.debug("activated");
	vscode.window.showInformationMessage(
		"Simple UnrealScript Extension is now active!",
	);
	const collector = new ClassesCollector();
	const unrealData = new UnrealData();
	const plugin = new UnrealPlugin(context, collector, unrealData);
	context.subscriptions.push(plugin.onPostSave());
	context.subscriptions.push(plugin.onActivated());
	context.subscriptions.push(plugin.onCompletion());
	context.subscriptions.push(plugin.onGoToDefinition());
}

export function deactivate() {}
