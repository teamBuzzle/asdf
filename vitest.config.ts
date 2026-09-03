import path from "node:path";
import { defineConfig } from "vitest/config";

// The main-process modules import nothing from `electron`, which is what lets
// them run here under plain Node. Keep it that way: a module that reaches for
// `app` or `BrowserWindow` belongs in `index.ts`, where the wiring lives.
export default defineConfig({
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
	test: {
		include: ["electron/**/*.test.ts", "src/**/*.test.ts"],
		environment: "node",
		// Spawning a real shell is slow on Windows, and these tests are worth the
		// wait: the defects they cover only ever showed up against a real pty.
		testTimeout: 20000,
	},
});
