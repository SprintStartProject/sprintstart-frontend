import { useSyncExternalStore } from "react";

/**
 * Which whole-window easter-egg effects exist. These are not modals — they
 * take over (or decorate) the entire screen, so any surface must be able to
 * fire them, and exactly one app-level layer renders them.
 */
export type EggEffectId = "barrel-roll" | "matrix";

type ActiveEffect = {
  id: EggEffectId;
  /**
   * Increments every time an effect fires, even the same one twice in a row.
   * The rendering layer keys off it so re-triggering replays the effect
   * instead of being swallowed by an equal-state bail-out.
   */
  seq: number;
};

let active: ActiveEffect | null = null;
let nextSeq = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Fires a whole-window easter-egg effect. Safe to call from anywhere —
 * chat submit, buddy submit, a future trigger — because the rendering
 * lives once, in {@link EggEffectsLayer}, not at the call site.
 */
export function playEggEffect(id: EggEffectId): void {
  active = { id, seq: nextSeq++ };
  emit();
}

/** Ends the running effect (called by the layer's own timers / Escape). */
export function clearEggEffect(): void {
  if (!active) return;
  active = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ActiveEffect | null {
  return active;
}

/**
 * Subscribes a component to the currently active effect. `null` when
 * nothing is playing. Pair with {@link EggEffectsLayer} rather than
 * rendering effects yourself: two layers would double-apply the body class.
 */
export function useActiveEggEffect(): ActiveEffect | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}
