// The preload bridge, and the only place the renderer reaches the main process.

declare global {
	interface Window {
		asdf: {
			invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
			on(channel: string, handler: (payload: unknown) => void): () => void;
		};
	}
}

export const bridge = window.asdf;
