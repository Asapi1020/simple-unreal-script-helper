type EventHandler<T extends (...args: string[]) => void> = T;

export class Event<T extends (...args: string[]) => void> {
	private handlers = new Set<EventHandler<T>>();

	public handle(handler: EventHandler<T>): void {
		this.handlers.add(handler);
	}

	public unhandle(handler: EventHandler<T>): void {
		if (!this.handlers.has(handler)) {
			throw new Error(
				"Handler is not handling this event, so cannot unhandle it.",
			);
		}
		this.handlers.delete(handler);
	}

	public fire(...args: Parameters<T>): void {
		for (const handler of this.handlers) {
			handler(...args);
		}
	}

	public getHandlerCount(): number {
		return this.handlers.size;
	}
}
