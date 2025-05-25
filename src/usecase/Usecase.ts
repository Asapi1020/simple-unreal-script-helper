import { ActivateUsecase } from "./ActivateUsecase";
import type { Context } from "./Context";

export class Usecase {
	public activeUsecase: ActivateUsecase;

	constructor(context: Context) {
		this.activeUsecase = new ActivateUsecase(context);
	}
}
