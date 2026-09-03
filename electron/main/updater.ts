import { app, type BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import { UPDATER_PROGRESS_EVENT, type UpdateInfo } from "@/ipc/bindings";
import { fail, type IpcResult, ok } from "./result";

// electron-updater is CommonJS, so the named exports are only reachable through
// the default import under ESM.
const { autoUpdater } = electronUpdater;

/**
 * Wraps electron-updater in the three calls the renderer's `Update` facade
 * makes. Downloading and installing are separate steps on purpose: the user
 * chooses when a ready update is applied, including "on quit".
 */
export function createUpdater(window: () => BrowserWindow | null) {
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = false;

	// An EventEmitter with no `error` listener rethrows, which would take the main
	// process down for a failure the renderer already handles through the result
	// of whichever call provoked it.
	autoUpdater.on("error", () => {});

	autoUpdater.on("download-progress", (progress) => {
		window()?.webContents.send(UPDATER_PROGRESS_EVENT, {
			transferred: progress.transferred,
			total: Number.isFinite(progress.total) ? progress.total : null,
		});
	});

	/** Set once `quitAndInstall` is on its way, so nothing else fights it. */
	let installing = false;

	return {
		/** True while the installer is taking over; the app is already quitting. */
		get installing() {
			return installing;
		},

		async check(): Promise<IpcResult<UpdateInfo | null>> {
			// An unpackaged build has no release to compare against, and asking
			// throws rather than reporting "up to date".
			if (!app.isPackaged) return ok(null);
			try {
				const result = await autoUpdater.checkForUpdates();
				// electron-updater decides what counts as an update. Comparing the two
				// version strings here instead would offer a downgrade as an upgrade
				// whenever the published release is behind the installed build.
				if (!result?.isUpdateAvailable) return ok(null);

				const { version, releaseNotes } = result.updateInfo;
				return ok({
					version,
					currentVersion: app.getVersion(),
					body: typeof releaseNotes === "string" ? releaseNotes : null,
				});
			} catch (thrown) {
				return fail(updateError(thrown));
			}
		},

		async download(): Promise<IpcResult<null>> {
			try {
				await autoUpdater.downloadUpdate();
				return ok(null);
			} catch (thrown) {
				return fail(updateError(thrown));
			}
		},

		install(): IpcResult<null> {
			try {
				installing = true;
				// Silent, and running again afterwards: between them these are what
				// the passive install mode the app shipped with did.
				autoUpdater.quitAndInstall(true, true);
				return ok(null);
			} catch (thrown) {
				installing = false;
				return fail(updateError(thrown));
			}
		},
	};
}

/**
 * Passes electron-updater's own wording through untouched. The renderer sorts a
 * failed integrity check from an ordinary network failure by reading it, so
 * rewriting the message here would blind it.
 */
function updateError(thrown: unknown) {
	return {
		kind: "io" as const,
		message: thrown instanceof Error ? thrown.message : String(thrown),
	};
}
