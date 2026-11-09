import type { Dispatch, MutableRefObject } from "react";
import { knowledgeService } from "../../services/knowledgeService";
import { ApiError } from "../../services/apiClient";
import type { DrawerAction } from "./drawerState";
import type { SummaryStreamHandlers } from "./types";

const RETRY_BASE_DELAY_MS = 2000;
const RETRY_MAX_DELAY_MS = 30000;

/** How a failed summary stream ends, as far as the drawer is concerned. */
export type SummaryFailure =
  { kind: "aborted" } | { kind: "indexing" } | { kind: "failed"; message: string };

/** Everything one summary run needs from the drawer that started it. */
export interface SummaryRun {
  projectId: string;
  artifactId: string;
  dispatch: Dispatch<DrawerAction>;
  /** The controller of the stream in flight; a new run aborts the previous one. */
  abortRef: MutableRefObject<AbortController | null>;
  /**
   * Bumped whenever the artifact changes or the drawer unmounts, and by every new run.
   * A run that finds it changed has been superseded and stops.
   */
  generationRef: MutableRefObject<number>;
}

/** The wait before retry number `attempt` (counted from zero): 2s, 4s, 8s, ... capped at 30s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt), RETRY_MAX_DELAY_MS);
}

/**
 * Sorts a stream error into what the drawer does about it: an abort ends the run
 * silently, a 503 means the artifact is still being indexed and worth retrying, and
 * anything else is shown to the user.
 */
export function classifySummaryFailure(err: unknown): SummaryFailure {
  if (err instanceof Error && err.name === "AbortError") {
    return { kind: "aborted" };
  }
  if (err instanceof ApiError && err.status === 503) {
    return { kind: "indexing" };
  }
  return { kind: "failed", message: err instanceof Error ? err.message : "Failed to summarize" };
}

/**
 * Waits `ms`, or less if `signal` aborts first. Resolves `true` when it was aborted
 * rather than rejecting: a summary run is fire-and-forget (`void run`), so a rejected
 * sleep would escape as an unhandled promise rejection.
 */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
  });
}

function handlersFor(dispatch: Dispatch<DrawerAction>): SummaryStreamHandlers {
  return {
    onStage: (name, detail) => dispatch({ type: "summarizeStage", name, detail }),
    onToken: (chunk) => dispatch({ type: "summarizeToken", chunk }),
    onCitation: (citation) => dispatch({ type: "summarizeCitation", citation }),
    onDone: () => dispatch({ type: "summarizeDone" }),
  };
}

function renewController(abortRef: MutableRefObject<AbortController | null>): AbortController {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  return controller;
}

async function streamOnce(run: SummaryRun, controller: AbortController) {
  try {
    await knowledgeService.streamArtifactSummary(
      run.projectId,
      run.artifactId,
      handlersFor(run.dispatch),
      controller.signal,
    );
    return null;
  } catch (err) {
    return classifySummaryFailure(err);
  }
}

/**
 * Streams the AI summary of an artifact into the drawer's state.
 *
 * The backend answers 503 while the artifact is still being indexed by the AI service.
 * The run then waits with exponential backoff and tries again, showing a "Preparing
 * summary..." state meanwhile; any other failure is surfaced at once with a retry button.
 *
 * Race-safety: each run captures a generation token, and a changed artifact or an
 * unmount bumps it, so a pending retry for the previous artifact bails out before
 * starting a stale stream. The retry delay is wired to the same `AbortController` as the
 * stream, so aborting cancels both the in-flight fetch and the pending timeout.
 */
export async function runSummary(run: SummaryRun): Promise<void> {
  const myGeneration = ++run.generationRef.current;
  run.dispatch({ type: "summarizeStart" });

  for (let attempt = 0; myGeneration === run.generationRef.current; attempt++) {
    const controller = renewController(run.abortRef);
    const failure = await streamOnce(run, controller);
    if (failure === null || failure.kind === "aborted") return;
    if (failure.kind === "failed") {
      run.dispatch({ type: "summarizeError", error: failure.message });
      return;
    }
    run.dispatch({ type: "summarizeIndexing" });
    if (await abortableSleep(retryDelayMs(attempt), controller.signal)) return;
  }
}
