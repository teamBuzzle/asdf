// The tabs of one project window and how they move between its splits. Pure,
// so the drag-and-drop rules can be checked without a DOM.
import type { Pane } from "./types";

/** One split of a window: a strip of tabs and the one that is showing. */
type PaneGroup = { id: string; panes: Pane[]; activeId: string };

/** A project is a window; its tabs live with it and nowhere else. A window
 *  is one group until a tab is dragged to its edge, which splits it. */
export type PaneWindow = { groups: PaneGroup[]; active: string };

/** Where a dragged tab lands: on another group's strip, or on the edge of a
 *  group's body, which opens a new group on that side. */
export type DropTarget =
	| { group: string }
	| { split: string; side: "left" | "right" };

let groupCount = 0;
const groupId = () => `pg${++groupCount}`;

export const emptyWindow = (): PaneWindow => {
	const id = groupId();
	return { groups: [{ id, panes: [], activeId: "" }], active: id };
};

/** A window holding just this tab. */
export const windowOf = (pane: Pane): PaneWindow => {
	const id = groupId();
	return { groups: [{ id, panes: [pane], activeId: pane.id }], active: id };
};

const lastId = (panes: Pane[]) => panes[panes.length - 1]?.id ?? "";

const holderOf = (window: PaneWindow, paneId: string) =>
	window.groups.find((group) => group.panes.some((p) => p.id === paneId));

/** Drops empty groups; a window always keeps at least one. */
const compact = (groups: PaneGroup[], active: string): PaneWindow => {
	const kept = groups.filter((group) => group.panes.length > 0);
	const final = kept.length > 0 ? kept : [groups[0]];
	return {
		groups: final,
		active: final.some((group) => group.id === active)
			? active
			: final[final.length - 1].id,
	};
};

/** Open in the active group, or go to it where it is already open. */
export function openPane(window: PaneWindow, pane: Pane): PaneWindow {
	const holder = holderOf(window, pane.id);
	const target = holder?.id ?? window.active;
	return {
		active: target,
		groups: window.groups.map((group) =>
			group.id !== target
				? group
				: {
						...group,
						panes: holder ? group.panes : [...group.panes, pane],
						activeId: pane.id,
					},
		),
	};
}

export function focusPane(window: PaneWindow, paneId: string): PaneWindow {
	const holder = holderOf(window, paneId);
	if (!holder) return window;
	return {
		active: holder.id,
		groups: window.groups.map((group) =>
			group.id === holder.id ? { ...group, activeId: paneId } : group,
		),
	};
}

/** Closing the last tab of a split closes the split. */
export function closePane(window: PaneWindow, paneId: string): PaneWindow {
	const groups = window.groups.map((group) => {
		const panes = group.panes.filter((item) => item.id !== paneId);
		return {
			...group,
			panes,
			activeId: group.activeId === paneId ? lastId(panes) : group.activeId,
		};
	});
	return compact(groups, window.active);
}

/** A dragged tab moves into another group, or onto a body's edge to open a
 *  new group there. A group left with no tabs closes. */
export function movePane(
	window: PaneWindow,
	paneId: string,
	drop: DropTarget,
): PaneWindow {
	const source = holderOf(window, paneId);
	const pane = source?.panes.find((item) => item.id === paneId);
	if (!source || !pane) return window;
	if ("group" in drop && drop.group === source.id) return window;
	// Splitting a lone tab off its own group would only rename the group.
	if ("split" in drop && drop.split === source.id && source.panes.length === 1)
		return window;

	const groups = window.groups.map((group) => {
		if (group.id !== source.id) return group;
		const panes = group.panes.filter((item) => item.id !== paneId);
		return {
			...group,
			panes,
			activeId: group.activeId === paneId ? lastId(panes) : group.activeId,
		};
	});

	if ("group" in drop) {
		return compact(
			groups.map((group) =>
				group.id === drop.group
					? { ...group, panes: [...group.panes, pane], activeId: paneId }
					: group,
			),
			drop.group,
		);
	}

	const fresh: PaneGroup = { id: groupId(), panes: [pane], activeId: paneId };
	const at = groups.findIndex((group) => group.id === drop.split);
	groups.splice(at + (drop.side === "right" ? 1 : 0), 0, fresh);
	return compact(groups, fresh.id);
}
