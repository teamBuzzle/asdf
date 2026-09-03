import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
	isPackaged: true,
	version: "0.2.0",
	sent: [] as Array<{ channel: string; payload: unknown }>,
	quitAndInstall: vi.fn(),
	checkForUpdates: vi.fn(),
	downloadUpdate: vi.fn(),
	listeners: new Map<string, (arg: unknown) => void>(),
};

vi.mock("electron", async () => {
	const { tmpdir } = await import("node:os");
	const path = await import("node:path");
	return {
		app: {
			get isPackaged() {
				return state.isPackaged;
			},
			getVersion: () => state.version,
			getPath: () => path.join(tmpdir(), "asdf-updater-test-logs"),
		},
	};
});

vi.mock("electron-updater", () => ({
	default: {
		autoUpdater: {
			autoDownload: true,
			autoInstallOnAppQuit: true,
			on(event: string, handler: (arg: unknown) => void) {
				state.listeners.set(event, handler);
			},
			checkForUpdates: () => state.checkForUpdates(),
			downloadUpdate: () => state.downloadUpdate(),
			quitAndInstall: (...args: unknown[]) => state.quitAndInstall(...args),
		},
	},
}));

const { createUpdater } = await import("./updater");
const mocked = (await import("electron-updater")).default
	.autoUpdater as unknown as {
	logger: { error(message: unknown): void } | null;
};

const window = () =>
	({
		webContents: {
			send: (channel: string, payload: unknown) =>
				state.sent.push({ channel, payload }),
		},
	}) as never;

beforeEach(() => {
	state.isPackaged = true;
	state.version = "0.2.0";
	state.sent = [];
	state.listeners.clear();
	vi.clearAllMocks();
});

describe("createUpdater", () => {
	it("reports nothing to install in an unpackaged build", async () => {
		state.isPackaged = false;
		const updater = createUpdater(window);

		await expect(updater.check()).resolves.toEqual({ ok: true, value: null });
		expect(state.checkForUpdates).not.toHaveBeenCalled();
	});

	it("offers the release electron-updater says is an update", async () => {
		state.checkForUpdates.mockResolvedValue({
			isUpdateAvailable: true,
			updateInfo: { version: "0.3.0", releaseNotes: "Notes" },
		});
		const updater = createUpdater(window);

		await expect(updater.check()).resolves.toEqual({
			ok: true,
			value: { version: "0.3.0", currentVersion: "0.2.0", body: "Notes" },
		});
	});

	/**
	 * The guard has to be electron-updater's own verdict. Comparing the two
	 * version strings would call a published release that is *behind* the
	 * installed build an available update, and offer a downgrade.
	 */
	it("offers nothing when the published release is not an update", async () => {
		state.checkForUpdates.mockResolvedValue({
			isUpdateAvailable: false,
			updateInfo: { version: "0.1.0", releaseNotes: null },
		});
		const updater = createUpdater(window);

		await expect(updater.check()).resolves.toEqual({ ok: true, value: null });
	});

	it("drops release notes that are not text", async () => {
		state.checkForUpdates.mockResolvedValue({
			isUpdateAvailable: true,
			updateInfo: {
				version: "0.3.0",
				releaseNotes: [{ version: "0.3.0", note: "html" }],
			},
		});
		const updater = createUpdater(window);

		const result = await updater.check();
		expect(result).toMatchObject({ ok: true, value: { body: null } });
	});

	it("passes the failure wording through so the renderer can read it", async () => {
		state.checkForUpdates.mockRejectedValue(
			new Error("sha512 checksum mismatch"),
		);
		const updater = createUpdater(window);

		await expect(updater.check()).resolves.toEqual({
			ok: false,
			error: { kind: "io", message: "sha512 checksum mismatch" },
		});
	});

	it("survives a background error, which an EventEmitter would rethrow", () => {
		createUpdater(window);
		expect(() =>
			state.listeners.get("error")?.(new Error("connection reset")),
		).not.toThrow();
	});

	it("forwards download progress with a total the renderer can use", () => {
		createUpdater(window);
		state.listeners.get("download-progress")?.({
			transferred: 512,
			total: 2048,
		});
		state.listeners.get("download-progress")?.({
			transferred: 1024,
			total: Number.POSITIVE_INFINITY,
		});

		expect(state.sent).toEqual([
			{
				channel: "updater://progress",
				payload: { transferred: 512, total: 2048 },
			},
			{
				channel: "updater://progress",
				payload: { transferred: 1024, total: null },
			},
		]);
	});

	it("flags that it is installing, so nothing else relaunches over it", () => {
		const updater = createUpdater(window);
		expect(updater.installing).toBe(false);

		expect(updater.install()).toEqual({ ok: true, value: null });
		expect(state.quitAndInstall).toHaveBeenCalledWith(true, true);
		expect(updater.installing).toBe(true);
	});

	it("keeps a log electron-updater writes to, for when a user reports a failure", async () => {
		const { readFileSync, rmSync } = await import("node:fs");
		const path = await import("node:path");
		const { tmpdir } = await import("node:os");
		const dir = path.join(tmpdir(), "asdf-updater-test-logs");
		rmSync(dir, { recursive: true, force: true });

		createUpdater(window);
		mocked.logger?.error("feed returned 404");

		const written = readFileSync(path.join(dir, "updater.log"), "utf8");
		expect(written).toMatch(/^\S+ error feed returned 404\n$/);
	});

	it("clears the flag when the installer refuses to start", () => {
		state.quitAndInstall.mockImplementation(() => {
			throw new Error("no installer");
		});
		const updater = createUpdater(window);

		expect(updater.install()).toMatchObject({ ok: false });
		expect(updater.installing).toBe(false);
	});
});
