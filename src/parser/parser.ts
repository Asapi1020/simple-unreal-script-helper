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
