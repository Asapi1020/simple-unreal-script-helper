import type { ClassReference } from "../UnrealClassReference";
import type { UnrealConst } from "../UnrealConst";
import type { UnrealFunction } from "../UnrealFunction";
import type { UnrealStruct } from "../UnrealStruct";
import type { UnrealVariable } from "../UnrealVariable";

export function formatClass(classReference: ClassReference): string {
	return ["```UnrealScript", classReference.declaration()].join("\n");
}

export function formatFunction(func: UnrealFunction): string {
	return ["```UnrealScript", func.declaration(), "```"].join("\n");
}

export function formatVariable(variable: UnrealVariable): string {
	return ["```UnrealScript", variable.declaration(), "```"].join("\n");
}

export function formatConst(constant: UnrealConst): string {
	return ["```UnrealScript", constant.declaration(), "```"].join("\n");
}

export function formatStruct(struct: UnrealStruct): string {
	return ["```UnrealScript", struct.declaration(), "```", ...struct.getVariables().map((v) => v.declaration())].join(
		"\n",
	);
}
