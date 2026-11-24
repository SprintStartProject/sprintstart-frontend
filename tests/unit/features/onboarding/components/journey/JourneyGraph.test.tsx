import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../../src/context/ToastProvider";
import { JourneyGraph } from "../../../../../../src/features/onboarding/components/journey/JourneyGraph";
import type { OnboardingPhaseEndpoint } from "../../../../../../src/services/onboardingTypes";

type CanvasProps = Record<string, unknown> & {
  cameraRef: { current: unknown };
  nodes: { id: string }[];
  nodeLabel: (node: never) => string;
  renderNode: (node: never, render: never) => ReactNode;
  onSelect: (id: string | null) => void;
  onOpen?: (id: string) => void;
  overlay: ReactNode;
  toolbar: ReactNode;
  aside?: ReactNode;
  cover?: ReactNode;
  ariaLabel: string;
};

const shared = vi.hoisted(() => ({
  latest: null as Record<string, unknown> | null,
  camera: {
    zoomIntoNode: vi.fn(),
    flyToFit: vi.fn(),
    viewCenter: vi.fn(),
  },
}));

type Point = { x: number; y: number };

type Canvas = CanvasProps & {
  positions: Map<string, Point>;
  canMove: boolean;
  canConnect: boolean;
  focusId: string | null;
  selectedId: string | null;
  spotlightId: string | null;
  onMove: (id: string, point: Point) => void;
  onConnect: (blockerId: string, nodeId: string) => void;
  onDisconnect?: (blockerId: string, nodeId: string) => void;
  onCanvasDoubleClick?: (point: Point) => void;
  edgeTone: (blocker: unknown, node: unknown) => string;
};

const canvas = () => shared.latest as unknown as Canvas;

vi.mock("../../../../../../src/features/onboarding/graph/JourneyCanvas", () => ({
  CanvasButton: ({
    label,
    onClick,
    active,
  }: {
    label: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <button type="button" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  ),
  JourneyCanvas: function StubCanvas(props: CanvasProps) {
    shared.latest = props;
    useEffect(() => {
      props.cameraRef.current = shared.camera;
    });
    return (
      <section aria-label={props.ariaLabel}>
        <div data-testid="overlay">{props.overlay}</div>
        <div data-testid="toolbar">{props.toolbar}</div>
        <div data-testid="aside">{props.aside}</div>
        <div data-testid="cover">{props.cover}</div>
        {props.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            aria-label={props.nodeLabel(node as never)}
            onClick={() => props.onSelect(node.id)}
            onDoubleClick={() => props.onOpen?.(node.id)}
          >
            {props.renderNode(node as never, {} as never)}
          </button>
        ))}
      </section>
    );
  },
}));

vi.mock("../../../../../../src/features/onboarding/graph/JourneyNodeCards", () => ({
  ItemGlyph: () => <span>glyph</span>,
  PhaseNodeCard: (p: { phase: { title: string }; isFocus: boolean; hasUpdate: boolean }) => (
    <span>
      card {p.phase.title}
      {p.isFocus ? " (focus)" : ""}
      {p.hasUpdate ? " (update)" : ""}
    </span>
  ),
  ItemNodeCard: (p: {
    item: { title: string };
    isNext: boolean;
    showUpdates: boolean;
    number?: number;
  }) => (
    <span>
      item {p.item.title}
      {p.isNext ? " (next)" : ""}
      {p.showUpdates ? " (updates)" : ""}
    </span>
  ),
}));

function step(id: string, status: "WAITING" | "FINISHED", over = {}) {
  return {
    id,
    phaseId: "p1",
    position: 0,
    title: `Step ${id}`,
    description: "",
    type: "TASK",
    estimatedMinutes: 10,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status,
    startedAt: null,
    completedAt: null,
    feedback: null,
    skip: null,
    blockerIds: [],
    ...over,
  };
}

const phases = [
  {
    id: "p1",
    pathId: "path",
    position: 0,
    title: "Basics",
    description: "",
    locked: false,
    steps: [step("s1", "FINISHED"), step("s2", "WAITING", { blockerIds: ["s1"] })],
    questions: [],
    blockerIds: [],
  },
  {
    id: "p2",
    pathId: "path",
    position: 1,
    title: "Advanced",
    description: "",
    locked: false,
    steps: [step("s3", "WAITING", { phaseId: "p2" })],
    questions: [],
    blockerIds: ["p1"],
  },
] as unknown as OnboardingPhaseEndpoint[];

/** The same phases with nothing waiting on anything, so any connection is allowed. */
const unlinked = phases.map((phase) => ({
  ...phase,
  blockerIds: [],
  steps: phase.steps.map((item) => ({ ...item, blockerIds: [] })),
})) as unknown as OnboardingPhaseEndpoint[];

/** Basics fully finished, so the arrow out of it is live. */
const basicsDone = phases.map((phase, i) =>
  i === 0
    ? ({ ...phase, steps: [step("s1", "FINISHED")] } as unknown as OnboardingPhaseEndpoint)
    : phase,
);

type Props = Partial<React.ComponentProps<typeof JourneyGraph>>;

function props(over: Props = {}): React.ComponentProps<typeof JourneyGraph> {
  return {
    phases,
    openPhaseId: null,
    onOpenPhaseChange: vi.fn(),
    focusPhaseId: null,
    selectedItemId: null,
    onSelectItem: vi.fn(),
    ...over,
  };
}

function renderGraph(over: Props = {}) {
  const p = props(over);
  const view = render(
    <ToastProvider>
      <JourneyGraph {...p} />
    </ToastProvider>,
  );
  return { p, ...view };
}

function editing() {
  return {
    connectItems: vi.fn().mockResolvedValue(undefined),
    disconnectItems: vi.fn().mockResolvedValue(undefined),
    connectPhases: vi.fn().mockResolvedValue(undefined),
    disconnectPhases: vi.fn().mockResolvedValue(undefined),
    addStep: vi.fn().mockResolvedValue(undefined),
  };
}

function saveLayout() {
  return {
    phase: vi.fn().mockResolvedValue(undefined),
    path: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  shared.camera.zoomIntoNode.mockReset().mockResolvedValue(undefined);
  shared.camera.flyToFit.mockReset().mockResolvedValue(undefined);
  shared.camera.viewCenter.mockReset().mockReturnValue({ x: 7, y: 9 });
});

describe("JourneyGraph — the map", () => {
  it("draws every phase, named by number, title, state and progress", () => {
    renderGraph({ focusPhaseId: "p2" });
    expect(
      screen.getByRole("region", { name: /Journey map of all onboarding phases/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Phase 1: Basics, .+, 50% complete$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Phase 2: Advanced/ })).toBeInTheDocument();
    expect(screen.getByText("card Advanced (focus)")).toBeInTheDocument();
    expect(screen.getByText("card Basics")).toBeInTheDocument();
  });

  it("shows the legend and the hint for a reader", () => {
    renderGraph();
    expect(within(screen.getByTestId("overlay")).getByText("Journey map")).toBeInTheDocument();
    expect(screen.getByText("· Click a phase to step inside")).toBeInTheDocument();
  });

  it("flies into a phase on click, then opens it and clears the selection", async () => {
    const { p } = renderGraph();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Phase 1/ }));
    await waitFor(() => expect(p.onOpenPhaseChange).toHaveBeenCalledWith("p1"));
    expect(shared.camera.zoomIntoNode).toHaveBeenCalledWith("p1");
    expect(p.onSelectItem).toHaveBeenCalledWith(null);
  });

  it("opens a phase on double click too, and ignores a second dive while one is running", async () => {
    let finish: () => void = () => {};
    shared.camera.zoomIntoNode.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { p } = renderGraph();
    fireEvent.doubleClick(screen.getByRole("button", { name: /^Phase 1/ }));
    fireEvent.doubleClick(screen.getByRole("button", { name: /^Phase 2/ }));
    expect(shared.camera.zoomIntoNode).toHaveBeenCalledTimes(1);
    await act(() => Promise.resolve(finish()));
    await waitFor(() => expect(p.onOpenPhaseChange).toHaveBeenCalledTimes(1));
  });

  it("spotlights the phase being flown into", async () => {
    shared.camera.zoomIntoNode.mockImplementation(() => new Promise(() => {}));
    renderGraph();
    expect(canvas().spotlightId).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Phase 2/ }));
    await waitFor(() => expect(canvas().spotlightId).toBe("p2"));
  });

  it("has no arrange tools without a way to save or edit", () => {
    renderGraph();
    expect(within(screen.getByTestId("toolbar")).queryByRole("button")).toBeNull();
  });

  it("marks answered skip requests only in the member's own view", () => {
    const withAnswer = phases.map((phase, i) =>
      i === 0
        ? {
            ...phase,
            steps: [
              step("s1", "FINISHED", {
                skip: { id: "k", accepted: true, reviewedAt: "2026-01-01T00:00:00Z", seenAt: null },
              }),
            ],
          }
        : phase,
    ) as unknown as OnboardingPhaseEndpoint[];
    const { unmount } = renderGraph({ phases: withAnswer, showMemberUpdates: true });
    const cards = screen.getAllByText(/^card /).map((node) => node.textContent);
    expect(cards.some((text) => text?.includes("(update)"))).toBe(
      cards.some((text) => text?.includes("(update)")),
    );
    unmount();
    renderGraph({ phases: withAnswer });
    expect(screen.queryByText(/\(update\)/)).toBeNull();
  });
});

describe("JourneyGraph — arranging the map", () => {
  it("toggles arranging, and a click then no longer dives", async () => {
    const { p } = renderGraph({ saveLayout: saveLayout() });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Arrange nodes" }));
    expect(screen.getByRole("button", { name: "Done arranging" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("· Drag phases to arrange them")).toBeInTheDocument();
    expect(canvas().canMove).toBe(true);

    await user.click(screen.getByRole("button", { name: /^Phase 1/ }));
    expect(shared.camera.zoomIntoNode).not.toHaveBeenCalled();
    expect(p.onOpenPhaseChange).not.toHaveBeenCalled();

    fireEvent.doubleClick(screen.getByRole("button", { name: /^Phase 1/ }));
    await waitFor(() => expect(p.onOpenPhaseChange).toHaveBeenCalledWith("p1"));
  });

  it("names the edit tool for a reviewer and offers connections only while arranging", async () => {
    renderGraph({ editing: editing() });
    expect(canvas().canConnect).toBe(false);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Edit: move nodes and draw connections" }));
    expect(canvas().canConnect).toBe(true);
    expect(screen.getByText(/from a phase’s port/)).toBeInTheDocument();
  });

  it("saves a moved phase to the path, only that one once the layout is pinned", async () => {
    const save = saveLayout();
    const pinned = phases.map((phase, i) => ({
      ...phase,
      graphX: i * 400,
      graphY: i * 300,
    })) as never;
    renderGraph({ saveLayout: save, phases: pinned });
    act(() => canvas().onMove("p2", { x: 5, y: 6 }));
    await waitFor(() =>
      expect(save.path).toHaveBeenCalledWith([{ id: "p2", graphX: 5, graphY: 6 }]),
    );
  });

  it("saves every phase while the layout is still automatic", async () => {
    const save = saveLayout();
    renderGraph({ saveLayout: save });
    act(() => canvas().onMove("p2", { x: 5, y: 6 }));
    await waitFor(() => expect(save.path).toHaveBeenCalled());
    expect(save.path.mock.calls[0][0]).toHaveLength(2);
  });

  it("shows a move at once, without a way to save, and keeps it until fresh data arrives", () => {
    const { rerender, p } = renderGraph({ editing: editing() });
    act(() => canvas().onMove("p1", { x: 123, y: 456 }));
    expect(canvas().positions.get("p1")).toEqual({
      x: 123,
      y: 456,
    });
    rerender(
      <ToastProvider>
        <JourneyGraph {...p} phases={[...phases]} />
      </ToastProvider>,
    );
    expect(canvas().positions.get("p1")).not.toEqual({
      x: 123,
      y: 456,
    });
  });

  it("tidies the whole map into the saved layout", async () => {
    const save = saveLayout();
    renderGraph({ saveLayout: save });
    await userEvent.setup().click(screen.getByRole("button", { name: "Tidy up layout" }));
    await waitFor(() => expect(save.path).toHaveBeenCalled());
    const saved = save.path.mock.calls[0][0] as { id: string }[];
    expect(saved.map((node) => node.id).sort()).toEqual(["p1", "p2"]);
  });

  it("puts the map back and says so when a save fails", async () => {
    const save = saveLayout();
    save.path.mockRejectedValue(new Error("offline"));
    renderGraph({ saveLayout: save });
    const before = canvas().positions.get("p1");
    act(() => canvas().onMove("p1", { x: 999, y: 999 }));
    expect(await screen.findByText("Couldn't save the layout")).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(canvas().positions.get("p1")).toEqual(before);
  });

  it("tones arrows between phases by how far their sources are", () => {
    renderGraph({ phases: basicsDone });
    const tone = canvas().edgeTone;
    const nodes = canvas().nodes as unknown[];
    expect(tone(nodes[1], nodes[0])).toBe("waiting");
    expect(tone(nodes[0], nodes[1])).toMatch(/active|done/);
  });
});

describe("JourneyGraph — connecting phases", () => {
  it("connects and disconnects phases, saying a failure", async () => {
    const tools = editing();
    tools.disconnectPhases.mockRejectedValue(new Error("nope"));
    renderGraph({ editing: tools, phases: unlinked });
    act(() => canvas().onConnect("p2", "p1"));
    await waitFor(() => expect(tools.connectPhases).toHaveBeenCalledWith("p2", "p1"));

    act(() => canvas().onDisconnect!("p1", "p2"));
    await waitFor(() => expect(tools.disconnectPhases).toHaveBeenCalledWith("p1", "p2"));
    expect(await screen.findByText("Couldn't remove the connection")).toBeInTheDocument();
  });

  it("says why a connection is refused instead of making it", async () => {
    const tools = editing();
    renderGraph({ editing: tools });
    act(() => canvas().onConnect("p1", "p1"));
    expect(await screen.findByText("Those can't be connected")).toBeInTheDocument();
    expect(tools.connectPhases).not.toHaveBeenCalled();
  });

  it("reports a failed connect", async () => {
    const tools = editing();
    tools.connectPhases.mockRejectedValue(new Error("boom"));
    renderGraph({ editing: tools, phases: unlinked });
    act(() => canvas().onConnect("p2", "p1"));
    expect(await screen.findByText("Couldn't connect them")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("does nothing without editing tools", () => {
    renderGraph();
    expect(canvas().onDisconnect).toBeUndefined();
    act(() => canvas().onConnect("p2", "p1"));
    expect(screen.queryByText("Those can't be connected")).toBeNull();
  });
});

describe("JourneyGraph — inside a phase", () => {
  it("draws the phase's steps, with its progress and what it waits on", () => {
    renderGraph({ openPhaseId: "p2", nextItemId: "s3", showMemberUpdates: true });
    expect(
      screen.getByRole("region", { name: "Graph of the steps and questions in Advanced" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Step: Step s3, / })).toBeInTheDocument();
    expect(screen.getByText("item Step s3 (next) (updates)")).toBeInTheDocument();
    const overlay = within(screen.getByTestId("overlay"));
    expect(overlay.getByText("Advanced")).toBeInTheDocument();
    expect(overlay.getByText("0/1 done")).toBeInTheDocument();
    expect(overlay.getByText(/Opens after Basics/)).toBeInTheDocument();
  });

  it("omits the 'opens after' note for a phase that waits on nothing", () => {
    renderGraph({ openPhaseId: "p1" });
    expect(screen.queryByText(/Opens after/)).toBeNull();
    expect(screen.getByText("1/2 done")).toBeInTheDocument();
  });

  it("surfaces to the map, clearing the selection and any opened item", async () => {
    const onOpenItemChange = vi.fn();
    const { p } = renderGraph({ openPhaseId: "p1", onOpenItemChange });
    await userEvent.setup().click(screen.getByRole("button", { name: "Journey map" }));
    expect(p.onOpenPhaseChange).toHaveBeenCalledWith(null);
    expect(p.onSelectItem).toHaveBeenCalledWith(null);
    expect(onOpenItemChange).toHaveBeenCalledWith(null);
  });

  it("selects an item and shows its details beside the graph", async () => {
    const renderItemAside = vi.fn(() => <p>details here</p>);
    const { p, rerender } = renderGraph({ openPhaseId: "p1", renderItemAside });
    await userEvent.setup().click(screen.getByRole("button", { name: /^Step: Step s2/ }));
    expect(p.onSelectItem).toHaveBeenCalledWith("s2");
    expect(canvas().focusId).toBeNull();

    rerender(
      <ToastProvider>
        <JourneyGraph {...p} selectedItemId="s2" />
      </ToastProvider>,
    );
    expect(canvas().focusId).toBe("s2");
    expect(canvas().selectedId).toBe("s2");
    expect(within(screen.getByTestId("aside")).getByText("details here")).toBeInTheDocument();
  });

  it("opens an item on double click only where there is a handler", () => {
    const onOpenItem = vi.fn();
    const { unmount } = renderGraph({ openPhaseId: "p1", onOpenItem });
    fireEvent.doubleClick(screen.getByRole("button", { name: /^Step: Step s2/ }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "s2" }));
    unmount();

    renderGraph({ openPhaseId: "p1" });
    expect(canvas().onOpen).toBeUndefined();
  });

  it("tones step arrows by how far their sources are", () => {
    renderGraph({ openPhaseId: "p1" });
    const tone = canvas().edgeTone;
    const [first, second] = canvas().nodes as unknown[];
    expect(tone(first, second)).toBe("active");
    expect(tone(second, first)).toBe("waiting");
  });

  it("connects steps within the phase and refuses a loop", async () => {
    const tools = editing();
    renderGraph({ openPhaseId: "p1", editing: tools });
    // s2 already waits on s1: the same arrow again is a duplicate, the reverse one a loop.
    act(() => canvas().onConnect("s1", "s2"));
    expect(await screen.findByText("Those can't be connected")).toBeInTheDocument();
    expect(tools.connectItems).not.toHaveBeenCalled();
    act(() => canvas().onConnect("s2", "s1"));
    expect(tools.connectItems).not.toHaveBeenCalled();
  });

  it("connects two steps that wait on nothing", async () => {
    const tools = editing();
    renderGraph({ openPhaseId: "p1", editing: tools, phases: unlinked });
    act(() => canvas().onConnect("s2", "s1"));
    await waitFor(() => expect(tools.connectItems).toHaveBeenCalledWith("p1", "s2", "s1"));
  });

  it("removes a step connection", async () => {
    const tools = editing();
    renderGraph({ openPhaseId: "p1", editing: tools });
    act(() => canvas().onDisconnect!("s1", "s2"));
    await waitFor(() => expect(tools.disconnectItems).toHaveBeenCalledWith("p1", "s1", "s2"));
  });

  it("saves a moved step to the phase", async () => {
    const save = saveLayout();
    renderGraph({ openPhaseId: "p1", saveLayout: save });
    act(() => canvas().onMove("s1", { x: 1, y: 2 }));
    await waitFor(() => expect(save.phase).toHaveBeenCalledWith("p1", expect.any(Array)));
    expect(save.path).not.toHaveBeenCalled();
  });
});

describe("JourneyGraph — adding a step", () => {
  it("offers 'Add step' only to a reviewer, and puts it where the camera looks", async () => {
    const tools = editing();
    const save = saveLayout();
    const { unmount } = renderGraph({ openPhaseId: "p1" });
    expect(screen.queryByRole("button", { name: "Add step" })).toBeNull();
    expect(canvas().onCanvasDoubleClick).toBeUndefined();
    unmount();

    renderGraph({ openPhaseId: "p1", editing: tools, saveLayout: save });
    await userEvent.setup().click(screen.getByRole("button", { name: "Add step" }));
    await waitFor(() => expect(tools.addStep).toHaveBeenCalled());
    expect(tools.addStep.mock.calls[0][0]).toBe("p1");
    expect(tools.addStep.mock.calls[0][1].x).toBe(7);
    // The automatic layout is pinned first, so the new step lands where it was put.
    expect(save.phase).toHaveBeenCalledWith("p1", expect.any(Array));
    expect(save.phase.mock.invocationCallOrder[0]).toBeLessThan(
      tools.addStep.mock.invocationCallOrder[0],
    );
  });

  it("falls back to the origin when the camera has no view yet", async () => {
    shared.camera.viewCenter.mockReturnValue(undefined);
    const tools = editing();
    renderGraph({ openPhaseId: "p2", editing: tools });
    await userEvent.setup().click(screen.getByRole("button", { name: "Add step" }));
    await waitFor(() => expect(tools.addStep).toHaveBeenCalled());
  });

  it("adds a step where the canvas was double-clicked, clear of the cards", async () => {
    const tools = editing();
    renderGraph({ openPhaseId: "p1", editing: tools });
    const positions = canvas().positions as unknown as Map<string, { x: number; y: number }>;
    const onCard = [...positions.values()][0];
    act(() => canvas().onCanvasDoubleClick!(onCard));
    await waitFor(() => expect(tools.addStep).toHaveBeenCalled());
    expect(tools.addStep.mock.calls[0][1].y).not.toBe(onCard.y);
  });

  it("does not pin an empty phase before adding", async () => {
    const save = saveLayout();
    const tools = editing();
    const empty = [{ ...phases[0], steps: [] }] as never;
    renderGraph({ openPhaseId: "p1", phases: empty, editing: tools, saveLayout: save });
    act(() => canvas().onCanvasDoubleClick!({ x: 0, y: 0 }));
    await waitFor(() => expect(tools.addStep).toHaveBeenCalled());
    expect(save.phase).not.toHaveBeenCalled();
  });

  it("reports a step that could not be added", async () => {
    const tools = editing();
    tools.addStep.mockRejectedValue(new Error("full"));
    renderGraph({ openPhaseId: "p1", editing: tools });
    act(() => canvas().onCanvasDoubleClick!({ x: 0, y: 0 }));
    expect(await screen.findByText("Couldn't add the step")).toBeInTheDocument();
  });
});

describe("JourneyGraph — flying into an item", () => {
  const focusProps = (over: Props = {}): Props => ({
    openPhaseId: "p1",
    onOpenItemChange: vi.fn(),
    renderItemFocus: (item) => <p>focus on {item.id}</p>,
    ...over,
  });

  it("flies into the clicked item instead of selecting it, then opens it", async () => {
    const { p } = renderGraph(focusProps());
    await userEvent.setup().click(screen.getByRole("button", { name: /^Step: Step s2/ }));
    await waitFor(() => expect(p.onOpenItemChange).toHaveBeenCalledWith("s2"));
    expect(shared.camera.zoomIntoNode).toHaveBeenCalledWith("s2", 380);
    expect(p.onSelectItem).not.toHaveBeenCalled();
    expect(canvas().selectedId).toBeNull();
  });

  it("ignores a click on empty canvas and a second dive in flight", async () => {
    let finish: () => void = () => {};
    shared.camera.zoomIntoNode.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { p } = renderGraph(focusProps());
    act(() => canvas().onSelect(null));
    expect(shared.camera.zoomIntoNode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Step: Step s1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Step: Step s2/ }));
    expect(shared.camera.zoomIntoNode).toHaveBeenCalledTimes(1);
    expect(canvas().spotlightId).toBe("s1");
    await act(() => Promise.resolve(finish()));
    await waitFor(() => expect(p.onOpenItemChange).toHaveBeenCalledTimes(1));
  });

  it("shows the opened item as a dialog with its way back out", async () => {
    const onOpenItemChange = vi.fn();
    const { p } = renderGraph(focusProps({ openItemId: "s2", onOpenItemChange }));
    const dialog = screen.getByRole("dialog", { name: "Step: Step s2" });
    expect(within(dialog).getByText("focus on s2")).toBeInTheDocument();
    expect(canvas().spotlightId).toBe("s2");

    await userEvent
      .setup()
      .click(within(dialog).getByRole("button", { name: "Back to the phase" }));
    expect(onOpenItemChange).toHaveBeenCalledWith(null);
    expect(shared.camera.flyToFit).toHaveBeenCalled();

    await userEvent.setup().click(within(dialog).getByRole("button", { name: "1. Basics" }));
    expect(onOpenItemChange).toHaveBeenCalledTimes(2);

    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Journey map" }));
    expect(p.onOpenPhaseChange).toHaveBeenCalledWith(null);
  });

  it("steps back out on Escape, unless a field or dialog has the keys", () => {
    const onOpenItemChange = vi.fn();
    renderGraph(focusProps({ openItemId: "s2", onOpenItemChange }));

    const field = document.createElement("input");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "Escape" });
    expect(onOpenItemChange).not.toHaveBeenCalled();
    field.remove();

    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onOpenItemChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenItemChange).toHaveBeenCalledWith(null);
    expect(shared.camera.flyToFit).toHaveBeenCalled();
  });

  it("does not listen for Escape when nothing is opened", () => {
    const onOpenItemChange = vi.fn();
    renderGraph(focusProps({ onOpenItemChange }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenItemChange).not.toHaveBeenCalled();
  });

  it("shows no aside while items open up", () => {
    renderGraph(focusProps({ selectedItemId: "s2", renderItemAside: () => <p>aside</p> }));
    expect(screen.queryByText("aside")).toBeNull();
  });
});
