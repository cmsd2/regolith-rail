import type { KeyboardEvent, PointerEvent } from "react";
import { clamp } from "../lib/layout-prefs.ts";
import styles from "./Workbench.module.css";

const STEP = 16;

/**
 * A draggable edge that resizes a column, also by keyboard: arrow keys move it, Home and End go to the
 * limits. `edge` says which side of the column it sits on, so dragging outwards widens the column.
 */
export function ColumnResizer({
  label,
  value,
  range,
  edge,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  range: { min: number; max: number };
  edge: "left" | "right";
  onChange(value: number): void;
  testId: string;
}) {
  const sign = edge === "right" ? 1 : -1;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const start = event.clientX;
    const initial = value;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (e: globalThis.PointerEvent) =>
      onChange(clamp(initial + sign * (e.clientX - start), range));
    const stop = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", stop);
      target.removeEventListener("pointercancel", stop);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", stop);
    target.addEventListener("pointercancel", stop);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === "ArrowRight"
        ? value + sign * STEP
        : event.key === "ArrowLeft"
          ? value - sign * STEP
          : event.key === "Home"
            ? range.min
            : event.key === "End"
              ? range.max
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(clamp(next, range));
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a column resizer is a focusable separator, which <hr> cannot be.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      tabIndex={0}
      className={styles.resizer}
      data-edge={edge}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      data-testid={testId}
    />
  );
}
