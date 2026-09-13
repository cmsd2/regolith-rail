import type { RunOutput } from "@regolith-rail/engine";
import { useMemo } from "react";
import { formatGameTime } from "../lib/format.ts";
import { playhead, usePlayhead, useWorkbench, workbench } from "../state/instance.ts";
import { PLAYBACK_SPEEDS } from "../state/playhead.ts";
import styles from "./Workbench.module.css";

interface Markers {
  stops: number[];
  reviews: { t: number; review: number; station: string }[];
  warnings: { t: number; stop: number }[];
  errors: { t: number; stop: number | undefined }[];
  events: { from: number; to: number; label: string }[];
}

function markers(output: RunOutput): Markers {
  const result: Markers = { stops: [], reviews: [], warnings: [], errors: [], events: [] };
  const open = new Map<string, { from: number; label: string }>();
  for (const event of output.events) {
    if (event.kind === "arrival") result.stops.push(event.t);
    else if (event.kind === "review")
      result.reviews.push({ t: event.t, review: event.review, station: event.station });
    // Warnings at reviews get their own markers with the review inspector.
    else if (event.kind === "warning" && event.stop !== undefined)
      result.warnings.push({ t: event.t, stop: event.stop });
    else if (event.kind === "error") result.errors.push({ t: event.t, stop: event.stop });
    else if (event.kind === "event-start")
      open.set(event.event, { from: event.t, label: event.label });
    else if (event.kind === "event-end") {
      const start = open.get(event.event);
      if (start) result.events.push({ ...start, to: event.t });
      open.delete(event.event);
    }
  }
  for (const start of open.values()) result.events.push({ ...start, to: output.durationMs });
  return result;
}

export function PlaybackControls() {
  const playing = usePlayhead((s) => s.playing);
  const speed = usePlayhead((s) => s.speed);
  const hasOutput = useWorkbench((s) => s.run.output !== null);
  return (
    <div className={styles.playback}>
      <button
        type="button"
        disabled={!hasOutput}
        onClick={() => (playing ? playhead.getState().pause() : playhead.getState().play())}
        data-testid="play"
      >
        {playing ? "Pause" : "Play"}
      </button>
      <label>
        Speed{" "}
        <select
          value={speed}
          onChange={(e) => playhead.getState().setSpeed(Number(e.target.value))}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <option key={s.speed} value={s.speed}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function Timeline() {
  const output = useWorkbench((s) => s.run.output);
  const t = usePlayhead((s) => s.t);
  const found = useMemo(() => (output ? markers(output) : null), [output]);
  if (!output || !found) return null;
  const duration = output.durationMs || 1;
  const pct = (time: number) => `${(time / duration) * 100}%`;
  const jump = (time: number, stop: number | undefined) => {
    playhead.getState().pause();
    playhead.getState().setTime(time);
    if (stop !== undefined) workbench.getState().selectStop(stop);
  };
  const stopPath = found.stops.map((s) => `M${(s / duration) * 1000},8V16`).join("");
  const reviewPath = found.reviews.map((r) => `M${(r.t / duration) * 1000},0V6`).join("");
  return (
    <div className={styles.timeline}>
      <div className={styles.markers} data-testid="timeline-markers">
        <svg className={styles.markerLayer} aria-hidden="true">
          <title>Stops and events</title>
          {found.events.map((e) => (
            <rect
              key={`${e.label}-${e.from}`}
              x={pct(e.from)}
              width={pct(e.to - e.from)}
              y={0}
              height={24}
              className={styles.eventBand}
            />
          ))}
          <svg viewBox="0 0 1000 24" preserveAspectRatio="none" width="100%" height="24">
            <title>Stops</title>
            <path d={stopPath} className={styles.stopTicks} />
            <path d={reviewPath} className={styles.reviewTicks} />
          </svg>
        </svg>
        {found.events.map((e) => (
          <span
            key={`label-${e.label}-${e.from}`}
            className={styles.eventLabel}
            style={{ left: pct(e.from), width: pct(e.to - e.from) }}
            title={`${e.label}: ${formatGameTime(e.from)} to ${formatGameTime(e.to)}`}
          />
        ))}
        {found.reviews.length > 0 && (
          <button
            type="button"
            className={styles.reviewTrack}
            aria-label="Reviews: choose a time to inspect the nearest review"
            title="Reviews: click to inspect the nearest review"
            data-testid="review-track"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const time = ((e.clientX - box.left) / Math.max(1, box.width)) * duration;
              let nearest = found.reviews[0] as Markers["reviews"][number];
              for (const r of found.reviews) {
                if (Math.abs(r.t - time) < Math.abs(nearest.t - time)) nearest = r;
              }
              playhead.getState().pause();
              playhead.getState().setTime(nearest.t);
              workbench.getState().selectReview(nearest.review);
            }}
          />
        )}
        {found.warnings.slice(0, 2000).map((w, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: warnings at the same time and stop are indistinguishable
            key={i}
            type="button"
            tabIndex={-1}
            className={styles.warningMarker}
            style={{ left: pct(w.t) }}
            aria-label={`Clamped action at ${formatGameTime(w.t)}`}
            data-testid="warning-marker"
            onClick={() => jump(w.t, w.stop)}
          />
        ))}
        {found.errors.map((e, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: errors at the same time and stop are indistinguishable
            key={i}
            type="button"
            className={styles.errorMarker}
            style={{ left: pct(e.t) }}
            aria-label={`Error at ${formatGameTime(e.t)}`}
            data-testid="error-marker"
            onClick={() => jump(e.t, e.stop)}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={duration}
        step={60_000}
        value={t}
        onChange={(e) => {
          playhead.getState().pause();
          playhead.getState().setTime(Number(e.target.value));
          workbench.getState().selectStop(null);
          workbench.getState().selectReview(null);
        }}
        aria-label="Time in the run"
        data-testid="scrubber"
        className={styles.scrubber}
      />
      <output className={styles.time} data-testid="playhead-time">
        {formatGameTime(t)}
      </output>
    </div>
  );
}
