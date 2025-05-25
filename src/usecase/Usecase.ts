import { ActivateUsecase } from "./ActivateUsecase";
import type { Context } from "./Context";
import { DefinitionUsecase } from "./DefinitionUsecase";

export class Usecase {
	public activeUsecase: ActivateUsecase;
	public definitionUsecase: DefinitionUsecase;

	constructor(context: Context) {
		this.activeUsecase = new ActivateUsecase(context);
		this.definitionUsecase = new DefinitionUsecase(context);
	}
}
