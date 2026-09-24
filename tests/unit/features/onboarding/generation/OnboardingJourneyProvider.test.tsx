import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingJourney } from "../../../../../src/features/onboarding/generation/OnboardingJourneyContext";
import { OnboardingJourneyProvider } from "../../../../../src/features/onboarding/generation/OnboardingJourneyProvider";
import { describeGenerationError } from "../../../../../src/features/onboarding/generation/generationErrors";
import { ApiError } from "../../../../../src/services/apiClient";
import { knowledgeService } from "../../../../../src/services/knowledgeService";
import { onboardingService } from "../../../../../src/services/onboardingService";

const state = vi.hoisted(() => ({ selectedProjectId: "proj1" }));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "u1", hasCompletedOnboarding: false, projectRoles: [] } }),
}));

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: state.selectedProjectId }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={["/"]}>
    <OnboardingJourneyProvider>{children}</OnboardingJourneyProvider>
  </MemoryRouter>
);

describe("OnboardingJourneyProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state.selectedProjectId = "proj1";
  });

  it("offers onboarding when the user already has a path", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockResolvedValue({
      id: "path",
      userId: "u1",
      createdAt: "",
      phases: [],
    });

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });

    await waitFor(() => expect(result.current.availability).toBe("path"));
  });

  it("leaves onboarding out when the project has nothing to build a path from", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    vi.spyOn(onboardingService, "fetchGenerationStatus").mockResolvedValue({
      running: false,
      hasActiveBlueprint: true,
    });
    vi.spyOn(knowledgeService, "hasIngestedContent").mockResolvedValue(false);

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });

    await waitFor(() => expect(result.current.availability).toBe("unavailable"));
    expect(result.current.unavailableReason).toBe("no-content");
  });

  it("says so when the project has no published blueprint", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    vi.spyOn(onboardingService, "fetchGenerationStatus").mockResolvedValue({
      running: false,
      hasActiveBlueprint: false,
    });

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });

    await waitFor(() => expect(result.current.unavailableReason).toBe("no-blueprint"));
  });

  it("tells several published blueprints apart from none", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    vi.spyOn(onboardingService, "fetchGenerationStatus").mockResolvedValue({
      running: false,
      hasActiveBlueprint: false,
      activeBlueprintCount: 2,
    });

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });

    await waitFor(() => expect(result.current.unavailableReason).toBe("several-blueprints"));
  });

  it("keeps the entry when the checks themselves fail", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    vi.spyOn(onboardingService, "fetchGenerationStatus").mockRejectedValue(new Error("down"));
    vi.spyOn(knowledgeService, "hasIngestedContent").mockRejectedValue(new Error("down"));

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });

    await waitFor(() => expect(result.current.availability).toBe("buildable"));
  });

  it("re-attaches to a generation that is already running on the backend", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    vi.spyOn(onboardingService, "fetchGenerationStatus").mockResolvedValue({
      running: true,
      runningProjectId: "proj1",
      hasActiveBlueprint: true,
    });
    const personalize = vi
      .spyOn(onboardingService, "personalizePath")
      .mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });

    await waitFor(() => expect(result.current.generation.status).toBe("running"));
    expect(personalize).toHaveBeenCalledWith("proj1", expect.any(Object), expect.any(AbortSignal));
  });

  it("tracks each phase of a generation and finishes with the new path", async () => {
    vi.spyOn(onboardingService, "fetchPath").mockRejectedValue(new ApiError(404, "none"));
    vi.spyOn(onboardingService, "fetchGenerationStatus").mockResolvedValue({
      running: false,
      hasActiveBlueprint: true,
    });
    vi.spyOn(knowledgeService, "hasIngestedContent").mockResolvedValue(true);
    let finish: () => void = () => {};
    vi.spyOn(onboardingService, "personalizePath").mockImplementation((_projectId, handlers) => {
      handlers.onStage?.("Setup", "Waiting");
      handlers.onStage?.("Setup", "Searching the project");
      handlers.onStage?.("Meetings", "Completed");
      return new Promise<void>((resolve) => {
        finish = () => {
          handlers.onPath({ id: "new", userId: "u1", createdAt: "", phases: [] });
          handlers.onDone();
          resolve();
        };
      });
    });

    const { result } = renderHook(() => useOnboardingJourney(), { wrapper });
    await waitFor(() => expect(result.current.availability).toBe("buildable"));

    act(() => result.current.startGeneration("proj1"));

    await waitFor(() => {
      const generation = result.current.generation;
      expect(generation.status === "running" && generation.phases).toEqual([
        { name: "Setup", detail: "Searching the project", state: "working" },
        { name: "Meetings", detail: "Completed", state: "done" },
      ]);
    });

    act(() => finish());

    await waitFor(() => expect(result.current.generation.status).toBe("done"));
    expect(result.current.availability).toBe("path");
  });

  it("turns backend failures into sentences a hire can act on", () => {
    expect(describeGenerationError("No active blueprint found for project: 42")).toMatch(
      /no published onboarding blueprint/,
    );
    expect(describeGenerationError("HTTP error! status: 403")).toMatch(/not assigned/);
    expect(describeGenerationError("Something else")).toBe("Something else");
  });
});
