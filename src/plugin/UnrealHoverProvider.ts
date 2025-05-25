import {
	type CancellationToken,
	Hover,
	type HoverProvider,
	MarkdownString,
	type Position,
	type ProviderResult,
	type TextDocument,
} from "vscode";
import type { Context } from "./Context";

export class UnrealHoverProvider implements HoverProvider {
	private context: Context;
	constructor(context: Context) {
		this.context = context;
	}
	provideHover(document: TextDocument, position: Position, _token: CancellationToken): ProviderResult<Hover> {
		const range = document.getWordRangeAtPosition(position);
		if (!range) {
			return;
		}
		const word = document.getText(range);
		const line = document.lineAt(position).text;
		const leftLine = line.substring(0, range.start.character).trim();
		const hoverText = this.context.usecase.definitionUsecase.resolveHoverText(leftLine, word, document.fileName);
		if (!hoverText) {
			return;
		}
		return new Hover(new MarkdownString(hoverText), range);
	}
}
