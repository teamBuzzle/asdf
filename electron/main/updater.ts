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

	autoUpdater.on("download-progress", (progress) => {
		window()?.webContents.send(UPDATER_PROGRESS_EVENT, {
			transferred: progress.transferred,
			total: Number.isFinite(progress.total) ? progress.total : null,
		});
	});

	return {
		async check(): Promise<IpcResult<UpdateInfo | null>> {
			// An unpackaged build has no release to compare against, and asking
			// throws rather than reporting "up to date".
			if (!app.isPackaged) return ok(null);
			try {
				const result = await autoUpdater.checkForUpdates();
				if (!result?.updateInfo) return ok(null);
				const { version, releaseNotes } = result.updateInfo;
				if (version === app.getVersion()) return ok(null);
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
				// The second argument keeps the installer silent on Windows, matching
				// the passive install mode the app shipped with.
				autoUpdater.quitAndInstall(true, true);
				return ok(null);
			} catch (thrown) {
				return fail(updateError(thrown));
			}
		},
	};
}

function updateError(thrown: unknown) {
	return {
		kind: "io" as const,
		message: thrown instanceof Error ? thrown.message : String(thrown),
	};
}
