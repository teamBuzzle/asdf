import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import {
	TERMINAL_EXIT_EVENT,
	TERMINAL_OUTPUT_EVENT,
	WINDOW_CLOSE_REQUESTED_EVENT,
} from "@/ipc/bindings";
import { ok } from "./result";
import { Registry } from "./terminal";
import { createUpdater } from "./updater";
import { open as openWorkspace } from "./workspace";

const directory = path.dirname(fileURLToPath(import.meta.url));

const terminals = new Registry();

// The app draws its own chrome and has no use for a menu bar. macOS keeps its
// default one, where the application menu is also what binds copy, paste and
// quit to their shortcuts.
if (process.platform !== "darwin") Menu.setApplicationMenu(null);

let main: BrowserWindow | null = null;
/** Set once the renderer has agreed the window may go. */
let closing = false;

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		title: "asdf",
		width: 1280,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		show: false,
		webPreferences: {
			preload: path.join(directory, "../preload/index.mjs"),
			sandbox: false,
		},
	});

	// Showing only once the first frame is painted avoids the white flash a
	// freshly created BrowserWindow shows while the renderer boots.
	window.once("ready-to-show", () => window.show());

	// Links to the outside world belong in the user's browser, not in a webview
	// with no address bar.
	window.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	window.on("close", (event) => {
		if (closing) return;
		event.preventDefault();
		window.webContents.send(WINDOW_CLOSE_REQUESTED_EVENT);
		// The renderer acknowledges as soon as its on-quit work is done. The timer
		// is only here so a wedged renderer cannot trap the window open.
		setTimeout(() => {
			if (!closing) {
				closing = true;
				window.close();
			}
		}, 5000);
	});

	if (process.env.ELECTRON_RENDERER_URL) {
		void window.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		void window.loadFile(path.join(directory, "../renderer/index.html"));
	}

	return window;
}

const updater = createUpdater(() => main);

ipcMain.handle("open_workspace", (_event, { path: raw }: { path: string }) =>
	openWorkspace(raw),
);

ipcMain.handle(
	"open_terminal",
	(
		_event,
		{ cwd, cols, rows }: { cwd: string | null; cols: number; rows: number },
	) =>
		terminals.open(cwd, cols, rows, {
			onOutput: (id, chunk) =>
				main?.webContents.send(TERMINAL_OUTPUT_EVENT, { id, chunk }),
			onExit: (id) => main?.webContents.send(TERMINAL_EXIT_EVENT, id),
		}),
);

ipcMain.handle(
	"write_terminal",
	(_event, { id, data }: { id: number; data: string }) =>
		terminals.write(id, data),
);

ipcMain.handle(
	"resize_terminal",
	(_event, { id, cols, rows }: { id: number; cols: number; rows: number }) =>
		terminals.resize(id, cols, rows),
);

ipcMain.handle("close_terminal", (_event, { id }: { id: number }) =>
	terminals.close(id),
);

ipcMain.handle("updater://check", () => updater.check());
ipcMain.handle("updater://download", () => updater.download());
ipcMain.handle("updater://install", () => updater.install());

ipcMain.handle("app://relaunch", () => {
	app.relaunch();
	closing = true;
	app.quit();
	return ok(null);
});

ipcMain.handle("shell://open-external", (_event, { url }: { url: string }) => {
	void shell.openExternal(url);
	return ok(null);
});

ipcMain.handle("window://close-ack", () => {
	closing = true;
	main?.close();
	return ok(null);
});

// A second instance would fight the first over the same pty sessions, so hand
// the argument to the window that already exists instead.
if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (!main) return;
		if (main.isMinimized()) main.restore();
		main.focus();
	});

	void app.whenReady().then(() => {
		main = createWindow();

		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) main = createWindow();
		});
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") app.quit();
	});

	// Killing the shells here is what keeps a quit from leaving one behind.
	app.on("before-quit", () => {
		closing = true;
		terminals.closeAll();
	});
}
