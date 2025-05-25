export function extractUnclosedBracketContent(line: string): string | null {
	let depth = 0;
	let lastOpenIndex: number | null = null;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === "(") {
			depth++;
			lastOpenIndex = i;
		} else if (char === ")") {
			depth--;
		}
	}

	if (depth === 0) {
		return line.trim();
	}
	if (lastOpenIndex !== null) {
		return line.slice(lastOpenIndex + 1).trim();
	}
	return null;
}

export function isFunctionOrEvent(line: string): boolean {
	return (line.toLowerCase().includes("function") || line.toLowerCase().includes("event")) && !line.includes("{");
}

export function isInBracketVariable(line: string): boolean {
	return (
		(line.endsWith("{") || line.endsWith(";") || line.endsWith("(") || line.split("(").pop()?.trim().endsWith(",")) ??
		false
	);
}

export function endsWithOperator(line: string): boolean {
	const OPERATOR_REGEX = /[+\-*/%&|^!<>=]$/;
	const lowerCaseLine = line.toLowerCase();
	return OPERATOR_REGEX.test(lowerCaseLine.trim());
}
