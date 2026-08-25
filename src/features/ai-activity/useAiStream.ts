import { useCallback, useRef, useState } from "react";
import {
  streamAiProgress,
  type AiProgressEvent,
  type AiProgressItem,
} from "../../services/aiStreamService";

/** One line in the activity log: a running stage or a landed item. */
export type AiActivityEntry = {
  key: string;
  kind: "stage" | "item" | "warning";
  label: string;
};

export type AiStreamPhase = "idle" | "streaming" | "done" | "error";

export type UseAiStreamResult = {
  phase: AiStreamPhase;
  entries: AiActivityEntry[];
  /**
   * The raw payload of each `item` event, in arrival order. Most surfaces ignore this and read
   * `entries` for the log; a surface that assembles live (the graph) reads these to draw each
   * validated element as it lands. Every payload here already cleared its grounding gate.
   */
  items: AiProgressItem[];
  errorMessage: string | null;
  /**
   * Opens the stream at [endpoint]. Resolves when it ends (done or error); the resolved boolean is
   * `true` on a clean finish, `false` on failure, so a caller can decide whether to re-read.
   */
  start: (endpoint: string) => Promise<boolean>;
  reset: () => void;
};

/**
 * Consumes an AI progress stream into an activity log — the reusable "watch it happen" hook.
 *
 * Deliberately holds no artifact: it exposes what the AI *did* (stages, landed items), and the
 * caller re-reads its own endpoint for the settled result once [start] resolves `true`. The stream
 * is a view, so this hook never becomes a second source of truth for the packet itself.
 */
export function useAiStream(): UseAiStreamResult {
  const [phase, setPhase] = useState<AiStreamPhase>("idle");
  const [entries, setEntries] = useState<AiActivityEntry[]>([]);
  const [items, setItems] = useState<AiProgressItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A per-hook counter for stable list keys; only ever used for React keys.
  const seq = useRef(0);

  const reset = useCallback(() => {
    setPhase("idle");
    setEntries([]);
    setItems([]);
    setErrorMessage(null);
  }, []);

  const append = useCallback((event: AiProgressEvent) => {
    const kind = event.type;
    if (kind !== "stage" && kind !== "item" && kind !== "warning") return;
    // An item carries a payload the graph draws live; collect it before the label guard, since a
    // future item could in principle arrive label-less without meaning it should be dropped.
    if (kind === "item" && event.item) {
      const payload = event.item;
      setItems((current) => [...current, payload]);
    }
    if (!event.label) return;
    const label = event.label;
    setEntries((current) => [...current, { key: `e${seq.current++}`, kind, label }]);
  }, []);

  const start = useCallback(
    (endpoint: string): Promise<boolean> => {
      setPhase("streaming");
      setEntries([]);
      setItems([]);
      setErrorMessage(null);
      return new Promise<boolean>((resolve) => {
        void streamAiProgress(endpoint, {
          onEvent: append,
          onDone: () => {
            setPhase("done");
            resolve(true);
          },
          onError: (message) => {
            setErrorMessage(message);
            setPhase("error");
            resolve(false);
          },
        });
      });
    },
    [append],
  );

  return { phase, entries, items, errorMessage, start, reset };
}
