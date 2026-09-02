// Fails if any locale drifts from en.json: a missing key renders the key name
// to the user, an extra key is dead weight nobody will ever delete.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../src/app/locales/", import.meta.url).pathname;
const flatten = (value, prefix = "") =>
	Object.entries(value).flatMap(([key, child]) =>
		typeof child === "object" && child !== null
			? flatten(child, `${prefix}${key}.`)
			: [`${prefix}${key}`],
	);

const read = (file) =>
	flatten(JSON.parse(readFileSync(join(dir, file), "utf8"))).sort();

const reference = read("en.json");
const problems = [];

for (const file of readdirSync(dir).filter(
	(f) => f.endsWith(".json") && f !== "en.json",
)) {
	const keys = read(file);
	const missing = reference.filter((k) => !keys.includes(k));
	const extra = keys.filter((k) => !reference.includes(k));
	if (missing.length) problems.push(`${file}: missing ${missing.join(", ")}`);
	if (extra.length)
		problems.push(`${file}: not in en.json — ${extra.join(", ")}`);
}

if (problems.length) {
	console.error(problems.join("\n"));
	process.exit(1);
}

console.log(`locales: ${reference.length} keys, all in sync`);
