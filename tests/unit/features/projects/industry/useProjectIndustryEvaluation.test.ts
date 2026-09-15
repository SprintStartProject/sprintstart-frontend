import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProjectIndustryEvaluation } from "../../../../../src/features/projects/industry/useProjectIndustryEvaluation";
import { ApiError } from "../../../../../src/services/apiClient";

vi.mock("../../../../../src/services/projectService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../src/services/projectService")>();
  return {
    ...actual,
    projectService: { ...actual.projectService, evaluateProjectIndustry: vi.fn() },
  };
});

describe("useProjectIndustryEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the evaluation and stores it as lastEvaluation on success", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockResolvedValue({
      industry: "Fintech",
      confidence: "high",
      evidence: ["Mentions payments"],
    });

    const { result } = renderHook(() => useProjectIndustryEvaluation("proj-1"));

    let outcome: Awaited<ReturnType<typeof result.current.evaluate>> | undefined;
    await act(async () => {
      outcome = await result.current.evaluate();
    });

    expect(outcome).toEqual({
      ok: true,
      evaluation: { industry: "Fintech", confidence: "high", evidence: ["Mentions payments"] },
    });
    expect(result.current.lastEvaluation).toEqual({
      industry: "Fintech",
      confidence: "high",
      evidence: ["Mentions payments"],
    });
    expect(result.current.isEvaluating).toBe(false);
  });

  it("sets isEvaluating while the call is in flight", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    let resolveCall: (value: {
      industry: string;
      confidence: "low";
      evidence: string[];
    }) => void = () => {};
    vi.mocked(projectService.evaluateProjectIndustry).mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const { result } = renderHook(() => useProjectIndustryEvaluation("proj-1"));

    act(() => {
      void result.current.evaluate();
    });

    await waitFor(() => expect(result.current.isEvaluating).toBe(true));

    await act(async () => {
      resolveCall({ industry: "", confidence: "low", evidence: [] });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isEvaluating).toBe(false));
  });

  it("maps a 502 to an AI-service-unavailable message", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockRejectedValue(
      new ApiError(502, "Bad Gateway"),
    );

    const { result } = renderHook(() => useProjectIndustryEvaluation("proj-1"));

    let outcome: Awaited<ReturnType<typeof result.current.evaluate>> | undefined;
    await act(async () => {
      outcome = await result.current.evaluate();
    });

    expect(outcome).toEqual({
      ok: false,
      message: "AI service unavailable. Try again in a moment.",
    });
  });

  it("maps a 503 to an AI-service-unavailable message", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockRejectedValue(
      new ApiError(503, "Service Unavailable"),
    );

    const { result } = renderHook(() => useProjectIndustryEvaluation("proj-1"));

    let outcome: Awaited<ReturnType<typeof result.current.evaluate>> | undefined;
    await act(async () => {
      outcome = await result.current.evaluate();
    });

    expect(outcome).toEqual({
      ok: false,
      message: "AI service unavailable. Try again in a moment.",
    });
  });

  it("passes through the backend message for other errors", async () => {
    const { projectService } = await import("../../../../../src/services/projectService");
    vi.mocked(projectService.evaluateProjectIndustry).mockRejectedValue(
      new ApiError(403, "Forbidden"),
    );

    const { result } = renderHook(() => useProjectIndustryEvaluation("proj-1"));

    let outcome: Awaited<ReturnType<typeof result.current.evaluate>> | undefined;
    await act(async () => {
      outcome = await result.current.evaluate();
    });

    expect(outcome).toEqual({ ok: false, message: "Forbidden" });
  });
});
