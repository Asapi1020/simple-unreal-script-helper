import * as vscode from "vscode";

let isHelperPanelOn = false;
let outputChannel: vscode.OutputChannel | undefined;

export function printToPanel(
	view: vscode.TextEditor,
	text: string,
	isOverwrite = true,
	isLog = false,
): void {
	isHelperPanelOn = true;

	if (!outputChannel || isOverwrite) {
		if (outputChannel) {
			outputChannel.dispose();
		}
		outputChannel = vscode.window.createOutputChannel(
			isLog ? "UnrealLog" : "UnrealScriptAutocomplete",
		);
	}

	if (isOverwrite) {
		outputChannel.clear();
	}

	outputChannel.append(text);
	outputChannel.show(true);

	const languageID = view.document.languageId;
	console.log(`Editor is using language: ${languageID}`);
}
