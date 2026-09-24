import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Finding, FindingSeverity } from "./findings";

/**
 * Browser storage for the project analysis: the last finished run, so it can be reopened later.
 *
 * Per viewer and project, in this browser only — there is no backend for it yet, so a run does
 * not follow the manager to another device. Every read and write is guarded:
 * storage can be off (private window, blocked site data), and then the analysis still works, it
 * only forgets.
 *
 * Changes are announced with a window event, so every reader of a record stays in step without
 * sharing a component.
 */

const CHANGE_EVENT = "sprintstart:pm-analysis-storage";

export type StoredTask = { id: Finding["area"]; label: string; status: string; note?: string };

/** One finished analysis, complete enough to show its results again. */
export type StoredAnalysis = {
  at: string;
  score: number;
  counts: Record<FindingSeverity, number>;
  /** Missing on runs stored before results were kept — those can only show their score. */
  findings?: Finding[];
  tasks?: StoredTask[];
  /** The run before this one, for the "since the last run" comparison. */
  previous?: { at: string; score: number } | null;
};

export function lastAnalysisKey(viewerId: string, projectId: string) {
  return `sprintstart.pm-analysis.${viewerId}.${projectId}`;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRecord(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the analysis carries on, it just does not remember.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

export function readRecord<T>(key: string): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab of the same browser changing it counts too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * One stored record, live: re-reads whenever it is written anywhere in the app. The raw string is
 * the snapshot (stable between reads), and parsing happens once per change.
 */
export function useStoredRecord<T>(key: string | null): [T | null, (value: T | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? readRaw(key) : null),
    () => null,
  );
  const value = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [raw]);
  const write = useCallback(
    (next: T | null) => {
      if (key) writeRecord(key, next);
    },
    [key],
  );
  return [value, write];
}
