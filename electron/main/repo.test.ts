import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTree, parseDiff, parseStatus, snapshot } from "./repo";

const repoRoot = path.resolve(import.meta.dirname, "../..");

describe("parseStatus", () => {
	it("classifies porcelain entries", () => {
		const out = parseStatus(" M a.ts\0?? b.ts\0D  c.ts\0R  old.ts\0new.ts\0");
		expect(out.get("a.ts")).toBe("modified");
		expect(out.get("b.ts")).toBe("added");
		expect(out.get("c.ts")).toBe("deleted");
		expect(out.get("old.ts")).toBe("modified");
		expect(out.has("new.ts")).toBe(false);
	});
});

describe("parseDiff", () => {
	it("pairs removed and added lines into change rows", () => {
		const rows = parseDiff(
			[
				"--- a/x",
				"+++ b/x",
				"@@ -1,3 +1,3 @@",
				" same",
				"-old",
				"+new",
				" tail",
			].join("\n"),
		);
		expect(rows.map((row) => row.kind)).toEqual(["same", "change", "same"]);
		expect(rows[1].before).toEqual({ n: 2, text: "old" });
		expect(rows[1].after).toEqual({ n: 2, text: "new" });
		expect(rows[2].before?.n).toBe(3);
	});

	it("leaves a gutter for a pure addition", () => {
		const rows = parseDiff("@@ -1 +1,2 @@\n same\n+added\n");
		expect(rows[1]).toMatchObject({
			kind: "add",
			before: undefined,
			after: { n: 2 },
		});
	});
});

describe("buildTree", () => {
	it("nests folders first and carries status", () => {
		const tree = buildTree(
			["b.ts", "src/a.ts"],
			new Map([["src/a.ts", "modified"]]),
		);
		expect(tree.map((node) => node.name)).toEqual(["src", "b.ts"]);
		expect(tree[0]).toMatchObject({
			kind: "dir",
			children: [{ name: "a.ts", status: "modified" }],
		});
	});
});

describe("snapshot", () => {
	it("reads this repository", async () => {
		const result = await snapshot(path.join(repoRoot, "electron"));
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.root).toBe(repoRoot);
		// CI checks pull requests out detached, where the branch is rightly null.
		expect(result.value.branch === null || result.value.branch.length > 0).toBe(
			true,
		);
		expect(result.value.tree.some((node) => node.name === "main")).toBe(true);
	});

	it("lists a plain folder whole, files and nested folders alike", async () => {
		const dir = await mkdtemp(path.join(tmpdir(), "asdf-walk-"));
		await mkdir(path.join(dir, "deep", "deeper"), { recursive: true });
		await writeFile(path.join(dir, "z.txt"), "");
		await writeFile(path.join(dir, ".dot"), "");
		await writeFile(path.join(dir, "deep", "deeper", "leaf.txt"), "");
		const result = await snapshot(dir);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.root).toBeNull();
		expect(result.value.tree.map((node) => node.name)).toEqual([
			"deep",
			".dot",
			"z.txt",
		]);
		expect(result.value.tree[0]).toMatchObject({
			children: [{ name: "deeper", children: [{ name: "leaf.txt" }] }],
		});
	});

	it("walks a plain folder", async () => {
		const result = await snapshot(path.join(repoRoot, "..", ".."));
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.root === null || result.value.root.length > 0).toBe(
			true,
		);
	});
});
