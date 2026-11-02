import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGenerationScreen } from "../../../../src/features/onboarding/hooks/useGenerationScreen";
import { useJourneyView } from "../../../../src/features/onboarding/hooks/useJourneyView";
import type { OnboardingJourneyValue } from "../../../../src/features/onboarding/generation/OnboardingJourneyContext";
import {
  hireJourneyViewKey,
  readJourneyView,
} from "../../../../src/features/onboarding/journeyViewMemory";
import type { OnboardingPhaseEndpoint } from "../../../../src/features/onboarding/types";

type Generation = OnboardingJourneyValue["generation"];

const running = (name: string): Generation => ({
  status: "running",
  projectId: "p",
  startedAt: 1000,
  phases: [{ name, detail: "", state: "working" }],
});

describe("useGenerationScreen", () => {
  it("starts from the running generation it is mounted into", () => {
    const { result } = renderHook(() => useGenerationScreen(running("A")));

    expect(result.current.lastGeneration).toEqual({
      phases: [{ name: "A", detail: "", state: "working" }],
      startedAt: 1000,
      completed: false,
    });
    expect(result.current.isDinoActive).toBe(false);
  });

  it("starts empty when nothing is running", () => {
    const { result } = renderHook(() => useGenerationScreen({ status: "idle" }));

    expect(result.current.lastGeneration).toEqual({ phases: [], startedAt: 0, completed: false });
  });

  it("follows a running generation as it progresses", () => {
    const { result, rerender } = renderHook(
      ({ generation }: { generation: Generation }) => useGenerationScreen(generation),
      { initialProps: { generation: running("A") } },
    );

    rerender({ generation: running("B") });

    expect(result.current.lastGeneration.phases[0].name).toBe("B");
    expect(result.current.lastGeneration.completed).toBe(false);
  });

  it("marks the snapshot completed when the generation is done, and keeps its phases", () => {
    const { result, rerender } = renderHook(
      ({ generation }: { generation: Generation }) => useGenerationScreen(generation),
      { initialProps: { generation: running("A") } },
    );

    rerender({ generation: { status: "done", path: null } });

    expect(result.current.lastGeneration.completed).toBe(true);
    expect(result.current.lastGeneration.phases[0].name).toBe("A");

    rerender({ generation: { status: "idle" } });
    expect(result.current.lastGeneration.completed).toBe(true);
  });

  it("lets go of the game when the generation fails", () => {
    const { result, rerender } = renderHook(
      ({ generation }: { generation: Generation }) => useGenerationScreen(generation),
      { initialProps: { generation: running("A") } },
    );
    act(() => result.current.setIsDinoActive(true));
    expect(result.current.isDinoActive).toBe(true);

    rerender({ generation: { status: "error", message: "broke" } });

    expect(result.current.isDinoActive).toBe(false);
  });

  it("keeps the game while the same generation is read again", () => {
    const generation = running("A");
    const { result, rerender } = renderHook(() => useGenerationScreen(generation));
    act(() => result.current.setIsDinoActive(true));

    rerender();

    expect(result.current.isDinoActive).toBe(true);
  });
});

function phase(id: string): OnboardingPhaseEndpoint {
  return {
    id,
    pathId: "path",
    position: 1,
    title: id,
    description: "",
    steps: [],
    questions: [],
    locked: false,
  };
}

const KEY = hireJourneyViewKey("viewer");

function mount(over: Partial<Parameters<typeof useJourneyView>[0]> = {}) {
  return renderHook((props: Parameters<typeof useJourneyView>[0]) => useJourneyView(props), {
    initialProps: {
      viewKey: KEY,
      arrivedForList: false,
      openPhaseId: undefined,
      phases: [phase("p1")],
      loadingState: "success" as const,
      ...over,
    },
  });
}

function remember(mode: "list" | "graph", graphPhaseId: string | null = null) {
  localStorage.setItem(KEY, JSON.stringify({ mode, graphPhaseId }));
}

describe("useJourneyView", () => {
  beforeEach(() => localStorage.clear());

  it("opens on the graph for a hire with nothing remembered", () => {
    expect(mount().result.current.viewMode).toBe("graph");
  });

  it("opens on what was remembered", () => {
    remember("list");

    expect(mount().result.current.viewMode).toBe("list");
  });

  it("opens on the graph when there is no account to remember anything for", () => {
    remember("list");

    expect(mount({ viewKey: null }).result.current.viewMode).toBe("graph");
  });

  it("opens the list for a visit that arrived for one, whatever was remembered", () => {
    remember("graph");

    expect(mount({ arrivedForList: true }).result.current.viewMode).toBe("list");
  });

  it("zooms the graph into the remembered phase if the path still has it", () => {
    remember("graph", "p1");

    const { result } = mount();

    expect(result.current.graphPhaseId).toBe("p1");
    expect(result.current.openGraphPhaseId).toBe("p1");
  });

  it("opens the map when the remembered phase is not on the path", () => {
    remember("graph", "gone");

    const { result } = mount();

    expect(result.current.graphPhaseId).toBe("gone");
    expect(result.current.openGraphPhaseId).toBeNull();
  });

  it("zooms into a phase arrived at by name before the remembered one", () => {
    remember("graph", "other");

    expect(mount({ openPhaseId: "p1" }).result.current.graphPhaseId).toBe("p1");
  });

  it("writes the view the hire chooses", () => {
    const { result } = mount();

    act(() => result.current.chooseViewMode("list"));

    expect(result.current.viewMode).toBe("list");
    expect(readJourneyView(KEY).mode).toBe("list");
  });

  it("writes the phase the graph is zoomed into", () => {
    const { result } = mount();

    act(() => result.current.setGraphPhaseId("p1"));

    expect(readJourneyView(KEY).graphPhaseId).toBe("p1");
  });

  it("does not write a list the visit was only sent to", () => {
    remember("graph");
    const { result } = mount({ arrivedForList: true });

    act(() => result.current.showListByArrival());

    expect(result.current.viewMode).toBe("list");
    expect(readJourneyView(KEY).mode).toBe("graph");
  });

  it("writes again once the hire chooses a view after being sent to the list", () => {
    remember("graph");
    const { result } = mount({ arrivedForList: true });

    act(() => result.current.chooseViewMode("graph"));
    act(() => result.current.chooseViewMode("list"));

    expect(readJourneyView(KEY).mode).toBe("list");
  });

  it("writes nothing before the path is there, or without an account", () => {
    const loading = mount({ loadingState: "loading" });
    act(() => loading.result.current.chooseViewMode("list"));
    expect(localStorage.getItem(KEY)).toBeNull();

    const anonymous = mount({ viewKey: null });
    act(() => anonymous.result.current.chooseViewMode("list"));
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
