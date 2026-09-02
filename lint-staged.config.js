export default {
	"*.{ts,tsx,js,jsx,mjs,cjs,json,html}": [
		"biome check --write --no-errors-on-unmatched",
	],
	"*.rs": ["rustfmt --edition 2021"],
	// Project-wide gates: ignore the file list, run once when any source is staged.
	"*.{ts,tsx,json}": () => [
		"pnpm typecheck",
		"pnpm knip",
		"pnpm check:locales",
	],
};
