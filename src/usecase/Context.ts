import type { Driver } from "../driver/Driver";
import type { Infra } from "../infra/Infra";

export interface Context {
	driver: Driver;
	infra: Infra;
}
