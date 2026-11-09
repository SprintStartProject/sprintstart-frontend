import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrawerAction } from "../../../../src/features/knowledge-base/drawerState";
import {
  abortableSleep,
  classifySummaryFailure,
  retryDelayMs,
  runSummary,
  type SummaryRun,
} from "../../../../src/features/knowledge-base/summaryStream";
import type { SummaryStreamHandlers } from "../../../../src/features/knowledge-base/types";
import { ApiError } from "../../../../src/services/apiClient";
import { knowledgeService } from "../../../../src/services/knowledgeService";

vi.mock("../../../../src/services/knowledgeService", () => ({
  knowledgeService: { streamArtifactSummary: vi.fn() },
}));

const stream = vi.mocked(knowledgeService.streamArtifactSummary);

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

function runWith(overrides: Partial<SummaryRun> = {}) {
  const dispatch = vi.fn<(action: DrawerAction) => void>();
  const run: SummaryRun = {
    projectId: "proj-1",
    artifactId: "art-1",
    dispatch,
    abortRef: { current: null },
    generationRef: { current: 0 },
    ...overrides,
  };
  return { run, dispatch };
}

function dispatchedTypes(dispatch: ReturnType<typeof runWith>["dispatch"]): string[] {
  return dispatch.mock.calls.map(([action]) => action.type);
}

describe("retryDelayMs", () => {
  it.each([
    [0, 2000],
    [1, 4000],
    [2, 8000],
    [3, 16000],
    [4, 30000],
    [5, 30000],
    [20, 30000],
  ])("waits %i -> %i ms", (attempt, expected) => {
    expect(retryDelayMs(attempt)).toBe(expected);
  });
});

describe("classifySummaryFailure", () => {
  it("treats an AbortError as an abort", () => {
    expect(classifySummaryFailure(abortError())).toEqual({ kind: "aborted" });
  });

  it("treats a 503 from the API as still indexing", () => {
    expect(classifySummaryFailure(new ApiError(503, "busy"))).toEqual({ kind: "indexing" });
  });

  it("shows any other API error with its message", () => {
    expect(classifySummaryFailure(new ApiError(500, "broken"))).toEqual({
      kind: "failed",
      message: "broken",
    });
  });

  it("shows a plain error with its message", () => {
    expect(classifySummaryFailure(new Error("nope"))).toEqual({ kind: "failed", message: "nope" });
  });

  it("does not take a non-API error carrying status 503 for indexing", () => {
    const lookalike = Object.assign(new Error("lookalike"), { status: 503 });

    expect(classifySummaryFailure(lookalike)).toEqual({ kind: "failed", message: "lookalike" });
  });

  it.each(["text", 42, null, undefined, { message: "object" }])(
    "uses the generic message for the non-error %j",
    (reason) => {
      expect(classifySummaryFailure(reason)).toEqual({
        kind: "failed",
        message: "Failed to summarize",
      });
    },
  );
});

describe("abortableSleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves false after the time has passed", async () => {
    const sleep = abortableSleep(1000, new AbortController().signal);

    await vi.advanceTimersByTimeAsync(999);
    const early = await Promise.race([sleep, Promise.resolve("pending")]);
    expect(early).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);

    await expect(sleep).resolves.toBe(false);
  });

  it("resolves true as soon as the signal aborts, and drops its timer", async () => {
    const controller = new AbortController();
    const sleep = abortableSleep(60000, controller.signal);

    controller.abort();

    await expect(sleep).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("runSummary", () => {
  beforeEach(() => {
    stream.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the summary, streams it for the artifact and ends", async () => {
    stream.mockResolvedValue(undefined);
    const { run, dispatch } = runWith();

    await runSummary(run);

    expect(dispatchedTypes(dispatch)).toEqual(["summarizeStart"]);
    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream).toHaveBeenCalledWith(
      "proj-1",
      "art-1",
      expect.any(Object),
      run.abortRef.current?.signal,
    );
  });

  it("turns what the stream reports into actions", async () => {
    const citation = { artifactId: "a", filename: "f.md", sourceUrl: null };
    stream.mockImplementation((_p, _a, handlers: SummaryStreamHandlers) => {
      handlers.onStage?.("retrieve", "Reading...");
      handlers.onToken("Hi");
      handlers.onCitation(citation);
      handlers.onDone();
      return Promise.resolve();
    });
    const { run, dispatch } = runWith();

    await runSummary(run);

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "summarizeStart" },
      { type: "summarizeStage", name: "retrieve", detail: "Reading..." },
      { type: "summarizeToken", chunk: "Hi" },
      { type: "summarizeCitation", citation },
      { type: "summarizeDone" },
    ]);
  });

  it("claims a new generation for every run", async () => {
    stream.mockResolvedValue(undefined);
    const { run } = runWith({ generationRef: { current: 4 } });

    await runSummary(run);

    expect(run.generationRef.current).toBe(5);
  });

  it("aborts the stream of the previous run before starting its own", async () => {
    stream.mockResolvedValue(undefined);
    const previous = new AbortController();
    const { run } = runWith({ abortRef: { current: previous } });

    await runSummary(run);

    expect(previous.signal.aborted).toBe(true);
    expect(run.abortRef.current).not.toBe(previous);
    expect(run.abortRef.current?.signal.aborted).toBe(false);
  });

  it("ends silently when the stream is aborted", async () => {
    stream.mockRejectedValue(abortError());
    const { run, dispatch } = runWith();

    await runSummary(run);

    expect(dispatchedTypes(dispatch)).toEqual(["summarizeStart"]);
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("reports any other failure and does not retry it", async () => {
    stream.mockRejectedValue(new Error("model down"));
    const { run, dispatch } = runWith();

    await runSummary(run);

    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "summarizeStart" },
      { type: "summarizeError", error: "model down" },
    ]);
    expect(stream).toHaveBeenCalledTimes(1);
  });

  describe("while the artifact is still being indexed", () => {
    const indexing = () => new ApiError(503, "Service Unavailable");

    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("waits 2s, 4s, 8s, 16s, then 30s between tries", async () => {
      stream.mockRejectedValue(indexing());
      const { run, dispatch } = runWith();
      const done = runSummary(run);

      await vi.advanceTimersByTimeAsync(0);
      let calls = 1;
      expect(stream).toHaveBeenCalledTimes(calls);
      for (const wait of [2000, 4000, 8000, 16000, 30000, 30000]) {
        await vi.advanceTimersByTimeAsync(wait - 1);
        expect(stream).toHaveBeenCalledTimes(calls);
        await vi.advanceTimersByTimeAsync(1);
        calls += 1;
        expect(stream).toHaveBeenCalledTimes(calls);
      }
      expect(dispatchedTypes(dispatch).filter((type) => type === "summarizeIndexing")).toHaveLength(
        calls,
      );

      run.abortRef.current?.abort();
      await done;
    });

    it("ends with the summary once a retry succeeds", async () => {
      stream.mockRejectedValueOnce(indexing()).mockResolvedValue(undefined);
      const { run, dispatch } = runWith();
      const done = runSummary(run);

      await vi.advanceTimersByTimeAsync(2000);
      await done;

      expect(dispatchedTypes(dispatch)).toEqual(["summarizeStart", "summarizeIndexing"]);
      expect(stream).toHaveBeenCalledTimes(2);
    });

    it("gives up the wait when the run is aborted", async () => {
      stream.mockRejectedValue(indexing());
      const { run } = runWith();
      const done = runSummary(run);
      await vi.advanceTimersByTimeAsync(0);

      run.abortRef.current?.abort();
      await done;
      await vi.advanceTimersByTimeAsync(120000);

      expect(stream).toHaveBeenCalledTimes(1);
    });

    it("does not start another stream once a newer run has taken over", async () => {
      stream.mockRejectedValue(indexing());
      const { run } = runWith();
      const done = runSummary(run);
      await vi.advanceTimersByTimeAsync(0);

      run.generationRef.current += 1;
      await vi.advanceTimersByTimeAsync(2000);
      await done;

      expect(stream).toHaveBeenCalledTimes(1);
    });
  });
});
