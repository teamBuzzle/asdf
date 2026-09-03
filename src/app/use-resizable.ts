import { type PointerEvent, useEffect, useState } from "react";

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/**
 * A column width the user drags, remembered per machine. `direction` is the
 * side the handle is on: 1 when dragging right widens the column, -1 when
 * dragging left does.
 */
export function useResizable(
	key: string,
	initial: number,
	min: number,
	max: number,
	direction: 1 | -1,
) {
	const [width, setWidth] = useState(() => {
		try {
			return clamp(Number(localStorage.getItem(key)) || initial, min, max);
		} catch {
			return initial;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(key, String(width));
		} catch {
			// Nothing to remember it with; the default comes back next launch.
		}
	}, [key, width]);

	const onPointerDown = (event: PointerEvent) => {
		event.preventDefault();
		const startX = event.clientX;
		const start = width;
		const move = (moved: globalThis.PointerEvent) =>
			setWidth(clamp(start + direction * (moved.clientX - startX), min, max));
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	return [width, onPointerDown] as const;
}
