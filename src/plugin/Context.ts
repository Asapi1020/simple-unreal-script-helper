import type { Driver } from "../driver/Driver";
import type { Infra } from "../infra/Infra";
import type { Usecase } from "../usecase/Usecase";

export interface Context {
	driver: Driver;
	infra: Infra;
	usecase: Usecase;
}
