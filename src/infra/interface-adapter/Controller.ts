import type { SerializableClass } from "../../domain/SymbolEntity";
import type { ClassReference } from "../../domain/UnrealClassReference";

export const toRawText = (classes: ClassReference[]): string => {
	const serialized = classes.map(toSerializableClasses);
	return JSON.stringify(serialized);
};

export const toSerializableClasses = (classes: ClassReference): SerializableClass => {
	return {
		name: classes.getName(),
		parentClassName: classes.getParentClass(),
		description: classes.getDescription(),
		fileName: classes.getFileName(),
	};
};
