export default {
	"*.{ts,tsx,js,jsx,json,html}": [
		"biome check --write --no-errors-on-unmatched",
	],
	"*.rs": ["rustfmt --edition 2021"],
	// Project-wide gates: ignore the file list, run once when any source is staged.
	"*.{ts,tsx}": () => ["pnpm typecheck", "pnpm knip"],
};
