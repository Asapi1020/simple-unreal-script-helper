import { Event } from "./Event";

export class EventManager {
	readonly parsingFinished = new Event<() => void>();
	readonly goToDefinition = new Event<
		(leftLine: string, word: string, fullLine: string) => void
	>();
	readonly rebuildCache = new Event<() => void>();
	readonly getClassReference = new Event<(className: string) => void>();
	readonly getAndOpenObject = new Event<(objectName: string) => void>();
}
