import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOpenEscalationCount } from "../../../../src/features/knowledge-request/useOpenEscalationCount";
import { knowledgeRequestService } from "../../../../src/services/knowledgeRequestService";
import type { KnowledgeRequest } from "../../../../src/features/knowledge-request/types";

vi.mock("../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: { listOpen: vi.fn() },
}));

const open = (id: string): KnowledgeRequest => ({
  id,
  projectId: "proj1",
  hireId: "h1",
  question: "How do we deploy?",
  status: "OPEN",
  createdAt: "2026-09-01T09:00:00Z",
  answeredAt: null,
  answer: null,
});

describe("useOpenEscalationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts the questions still waiting on a person", async () => {
    vi.mocked(knowledgeRequestService.listOpen).mockResolvedValue([open("r1"), open("r2")]);

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(result.current).toBe(2));
  });

  it("reports nothing for an inbox that is clear", async () => {
    vi.mocked(knowledgeRequestService.listOpen).mockResolvedValue([]);

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(knowledgeRequestService.listOpen).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });

  it("does not read at all for somebody who cannot open the inbox", () => {
    renderHook(() => useOpenEscalationCount("proj1", false));

    expect(knowledgeRequestService.listOpen).not.toHaveBeenCalled();
  });

  it("does not read while no project is selected", () => {
    renderHook(() => useOpenEscalationCount(null, true));

    expect(knowledgeRequestService.listOpen).not.toHaveBeenCalled();
  });

  // A badge is not worth surfacing an error for, and a number nobody can trust
  // is worse than no number: a failed read leaves the entry unmarked.
  it("stays quiet when the read fails", async () => {
    vi.mocked(knowledgeRequestService.listOpen).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useOpenEscalationCount("proj1", true));

    await waitFor(() => expect(knowledgeRequestService.listOpen).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });

  it("re-reads on a project switch, so the badge belongs to the project on screen", async () => {
    vi.mocked(knowledgeRequestService.listOpen).mockResolvedValue([open("r1")]);

    const { rerender } = renderHook(({ projectId }) => useOpenEscalationCount(projectId, true), {
      initialProps: { projectId: "proj1" },
    });

    await waitFor(() => expect(knowledgeRequestService.listOpen).toHaveBeenCalledTimes(1));

    rerender({ projectId: "proj2" });

    await waitFor(() => expect(knowledgeRequestService.listOpen).toHaveBeenCalledTimes(2));
    expect(vi.mocked(knowledgeRequestService.listOpen).mock.calls[1][0]).toBe("proj2");
  });

  it("does not re-read on rapid navigation within the rate limit", async () => {
    vi.mocked(knowledgeRequestService.listOpen).mockResolvedValue([]);

    const { rerender } = renderHook(({ route }) => useOpenEscalationCount("proj1", true, route), {
      initialProps: { route: "/pm-dashboard" },
    });

    await waitFor(() => expect(knowledgeRequestService.listOpen).toHaveBeenCalledTimes(1));

    rerender({ route: "/team" });
    rerender({ route: "/chat" });

    expect(knowledgeRequestService.listOpen).toHaveBeenCalledTimes(1);
  });
});
