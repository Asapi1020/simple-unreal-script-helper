import { ActivateUsecase } from "./ActivateUsecase";
import type { Context } from "./Context";
import { gotoDefinitionUsecase } from "./GotoDefinitionUsecase";

export class Usecase {
	public activeUsecase: ActivateUsecase;
	public gotoDefinitionUsecase: gotoDefinitionUsecase;

	constructor(context: Context) {
		this.activeUsecase = new ActivateUsecase(context);
		this.gotoDefinitionUsecase = new gotoDefinitionUsecase(context);
	}
}
