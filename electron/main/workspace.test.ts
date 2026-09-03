import { tmpdir } from "node:os";
import path from "node:path";
import { execPath } from "node:process";
import { describe, expect, it } from "vitest";
import { open } from "./workspace";

const repoRoot = path.resolve(import.meta.dirname, "../..");

describe("workspace.open", () => {
	it("rejects a missing path", () => {
		const result = open(path.join(tmpdir(), "definitely-does-not-exist-9f3a"));
		expect(result).toMatchObject({ ok: false, error: { kind: "notFound" } });
	});

	it("rejects a file", () => {
		const result = open(execPath);
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "notADirectory" },
		});
	});

	it("reads a directory", () => {
		const result = open(tmpdir());
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.name).not.toBe("");
		expect(result.value.isGitRepo).toBe(false);
	});

	it("detects a git repo", () => {
		const result = open(repoRoot);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.isGitRepo).toBe(true);
		expect(result.value.name).toBe(path.basename(repoRoot));
	});

	it("resolves the path it reports", () => {
		const result = open(path.join(repoRoot, "electron", ".."));
		if (!result.ok) throw new Error(result.error.message);
		expect(result.value.path).toBe(path.resolve(repoRoot));
	});
});
