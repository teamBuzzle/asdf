import { describe, expect, it } from "vitest";
import { closePane, movePane, openPane, windowOf } from "./panes";
import type { Pane } from "./types";

const tab = (n: number): Pane => ({
	kind: "session",
	id: `session:s${n}`,
	sessionId: `s${n}`,
});

const twoTabs = () => openPane(windowOf(tab(1)), tab(2));

describe("movePane", () => {
	it("splits a tab off to the right and focuses the new group", () => {
		const before = twoTabs();
		const [group] = before.groups;
		const after = movePane(before, "session:s2", {
			split: group.id,
			side: "right",
		});
		expect(after.groups.map((g) => g.panes.map((p) => p.id))).toEqual([
			["session:s1"],
			["session:s2"],
		]);
		expect(after.active).toBe(after.groups[1].id);
		expect(after.groups[0].activeId).toBe("session:s1");
	});

	it("splits to the left in front of the source", () => {
		const before = twoTabs();
		const after = movePane(before, "session:s2", {
			split: before.groups[0].id,
			side: "left",
		});
		expect(after.groups[0].panes[0].id).toBe("session:s2");
	});

	it("does nothing when a lone tab splits off its own group", () => {
		const before = windowOf(tab(1));
		expect(
			movePane(before, "session:s1", {
				split: before.groups[0].id,
				side: "right",
			}),
		).toBe(before);
	});

	it("moving the last tab out of a group closes the group", () => {
		const before = twoTabs();
		const split = movePane(before, "session:s2", {
			split: before.groups[0].id,
			side: "right",
		});
		const [left, right] = split.groups;
		const merged = movePane(split, "session:s2", { group: left.id });
		expect(merged.groups).toHaveLength(1);
		expect(merged.groups[0].id).toBe(left.id);
		expect(merged.groups[0].activeId).toBe("session:s2");
		expect(merged.groups[0].id).not.toBe(right.id);
	});
});

describe("closePane", () => {
	it("keeps one empty group when the last tab closes", () => {
		const after = closePane(windowOf(tab(1)), "session:s1");
		expect(after.groups).toHaveLength(1);
		expect(after.groups[0].panes).toEqual([]);
		expect(after.active).toBe(after.groups[0].id);
	});

	it("drops a split whose last tab closed", () => {
		const before = twoTabs();
		const split = movePane(before, "session:s2", {
			split: before.groups[0].id,
			side: "right",
		});
		const after = closePane(split, "session:s2");
		expect(after.groups).toHaveLength(1);
		expect(after.active).toBe(after.groups[0].id);
	});
});
