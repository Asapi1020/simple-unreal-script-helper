import type { UnrealConst } from "./UnrealConst";
import type { UnrealFunction } from "./UnrealFunction";
import type { UnrealStruct } from "./UnrealStruct";
import type { UnrealVariable } from "./UnrealVariable";

export interface ClassMembers {
	functions: UnrealFunction[];
	consts: UnrealConst[];
	structs: UnrealStruct[];
	variables: UnrealVariable[];
}
