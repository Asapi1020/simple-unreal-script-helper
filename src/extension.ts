import type * as vscode from "vscode";
import { Driver } from "./driver/Driver";
import { Infra } from "./infra/Infra";
import { UnrealPlugin } from "./plugin/UnrealPlugin";
import { Usecase } from "./usecase/Usecase";

export function activate(context: vscode.ExtensionContext): void {
	console.debug("activated");

	const driver = new Driver(context.extensionPath);
	const infra = new Infra({ driver });
	const usecase = new Usecase({ driver, infra });
	const plugin = new UnrealPlugin({ driver, infra, usecase });
	context.subscriptions.push(plugin.onPostSave());
	context.subscriptions.push(plugin.onActivated());
	context.subscriptions.push(plugin.onCompletion());
	context.subscriptions.push(plugin.onGoToDefinition());
}
