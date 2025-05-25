import { isArray, isObject, toString as toStr } from "@asp1020/type-utils";
import type { SerializableClass } from "../../domain/SymbolEntity";
import { throwError } from "../../domain/errorHandler";

export const toSerializableClasses = (raw: string): SerializableClass[] => {
	const json = JSON.parse(raw);
	if (!isArray(json)) {
		throw new Error("Invalid JSON format");
	}
	return json.map((item: unknown) => {
		if (!isObject(item)) {
			throw new Error("Invalid JSON format");
		}
		return {
			name: toStr(item.name) ?? throwError("Invalid name"),
			parentClassName: toStr(item.parentClassName) ?? throwError("Invalid parentClassName"),
			description: toStr(item.description) ?? throwError("Invalid description"),
			fileName: toStr(item.fileName) ?? throwError("Invalid fileName"),
		};
	});
};
