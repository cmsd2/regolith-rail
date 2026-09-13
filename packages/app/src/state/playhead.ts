import { createStore } from "zustand/vanilla";

export interface PlayheadState {
  /** Game time shown by the map, charts and timeline. */
  t: number;
  playing: boolean;
  /** Game milliseconds per real second. */
  speed: number;
  duration: number;
  setTime(t: number): void;
  setDuration(duration: number): void;
  play(): void;
  pause(): void;
  setSpeed(speed: number): void;
  /** Advances playback by `realMs` of wall time; stops at the end. */
  advance(realMs: number): void;
}

export const PLAYBACK_SPEEDS = [
  { label: "1 hour/s", speed: 3_600_000 },
  { label: "4 hours/s", speed: 14_400_000 },
  { label: "1 sol/s", speed: 86_400_000 },
] as const;

/**
 * Playback position, kept outside React state that re-renders: canvases read
 * it directly on every animation frame.
 */
export function createPlayhead() {
  return createStore<PlayheadState>()((set, get) => ({
    t: 0,
    playing: false,
    speed: PLAYBACK_SPEEDS[1].speed,
    duration: 0,
    setTime: (t) => set({ t: Math.max(0, Math.min(t, get().duration)) }),
    setDuration: (duration) => set({ duration, t: Math.min(get().t, duration) }),
    play: () => set({ playing: true, t: get().t >= get().duration ? 0 : get().t }),
    pause: () => set({ playing: false }),
    setSpeed: (speed) => set({ speed }),
    advance(realMs) {
      const { t, speed, duration, playing } = get();
      if (!playing) return;
      const next = t + (realMs * speed) / 1000;
      if (next >= duration) set({ t: duration, playing: false });
      else set({ t: next });
    },
  }));
}
