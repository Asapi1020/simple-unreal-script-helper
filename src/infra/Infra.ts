import { ClassesCollector } from "./ClassesCollector";
import type { Context } from "./Context";
import { FunctionsCollector } from "./FunctionsCollector";
import { UnrealData } from "./UnrealData";

export class Infra {
	public unrealData: UnrealData;
	public classesCollector: ClassesCollector;
	public functionsCollector: FunctionsCollector;

	constructor(context: Context) {
		this.unrealData = new UnrealData(context);
		this.classesCollector = new ClassesCollector(context);
		this.functionsCollector = new FunctionsCollector(context);
	}
}
