import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const alias = { "@": path.resolve(__dirname, "./src") };

export default defineConfig({
	main: {
		// node-pty is a native addon and electron-updater reads files from disk at
		// runtime; neither survives being bundled.
		plugins: [externalizeDepsPlugin()],
		resolve: { alias },
		build: {
			lib: { entry: "electron/main/index.ts" },
		},
	},

	preload: {
		plugins: [externalizeDepsPlugin()],
		resolve: { alias },
		build: {
			lib: { entry: "electron/preload/index.ts" },
		},
	},

	renderer: {
		root: ".",
		plugins: [react(), tailwindcss()],
		resolve: { alias },
		// release-please bumps package.json; the footer shows what it says.
		define: {
			__APP_VERSION__: JSON.stringify(
				JSON.parse(readFileSync("package.json", "utf8")).version,
			),
		},
		build: {
			rollupOptions: { input: path.resolve(__dirname, "index.html") },
		},
	},
});
