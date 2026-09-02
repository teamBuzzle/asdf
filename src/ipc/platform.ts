// Everything the app uses from Tauri's plugin surface. Features import from
// here so `@tauri-apps/*` stays confined to this layer — see
// .claude/rules/architecture.md.
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type { Update };

export const platform = {
	checkForUpdate: check,
	relaunch,
	openExternal: openUrl,
	onWindowClose: (handler: () => Promise<void> | void) =>
		getCurrentWindow().onCloseRequested(handler),
	listen,
};
