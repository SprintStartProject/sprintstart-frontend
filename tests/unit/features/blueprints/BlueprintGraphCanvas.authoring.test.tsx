import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNode,
} from "../../../../src/features/blueprints/components/BlueprintGraphCanvas.tsx";
import { EDGE_STYLE_SWATCH } from "../../../../src/features/graph-diagram/edgeStyles.ts";
import { BlueprintNodeCard } from "../../../../src/features/blueprints/components/BlueprintNodeCard.tsx";

type CanvasProps = Parameters<typeof BlueprintGraphCanvas<BlueprintGraphCanvasNode>>[0];

function at(id: string, x: number, y: number, blockerIds: string[] = []): BlueprintGraphCanvasNode {
  return { id, title: `Node ${id}`, graphX: x, graphY: y, blockerIds };
}

/** Unplaced, so the canvas lays it out itself. */
function loose(id: string, blockerIds: string[] = []): BlueprintGraphCanvasNode {
  return { id, title: `Node ${id}`, graphX: null, graphY: null, blockerIds };
}

const ok = () => Promise.resolve();

/** A refusal that carries no message of its own, the way a rejected request can. */
function failWithoutReason(): Promise<void> {
  const reason: unknown = "nope";
  throw reason;
}

function renderCanvas(nodes: BlueprintGraphCanvasNode[], over: Partial<CanvasProps> = {}) {
  const props: CanvasProps = {
    nodes,
    title: "Path graph",
    description: "Arrange the phases.",
    editable: true,
    onPositionChange: vi.fn(ok),
    onAddBlocker: vi.fn(ok),
    onRemoveBlocker: vi.fn(ok),
    renderNode: (item, cardProps) => (
      <BlueprintNodeCard
        {...cardProps}
        title={item.title}
        kind={{ label: "Phase", icon: Layers }}
      />
    ),
    ...over,
  };
  return { props, ...render(<BlueprintGraphCanvas<BlueprintGraphCanvasNode> {...props} />) };
}

const nodeEl = (id: string) => document.querySelector<HTMLElement>(`[data-journey-node="${id}"]`)!;
const portEl = (id: string) => document.querySelector<HTMLElement>(`[data-port-for="${id}"]`)!;

/** A drag of a node by a distance, the way the canvas hears one: down, a move past the threshold, up. */
function drag(id: string, dx = 80, dy = 40) {
  const element = screen.getByTestId(`graph-node-${id}`);
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
}

/** A line drawn from one node's handle to another node. */
function connect(from: string, to: string) {
  document.elementFromPoint = () => nodeEl(to);
  const port = portEl(from);
  fireEvent.pointerDown(port, { button: 0, pointerId: 2, clientX: 5, clientY: 5 });
  fireEvent.pointerUp(port, { pointerId: 2, clientX: 9, clientY: 9 });
}

afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
});

const SNAP = 10;

describe("BlueprintGraphCanvas: moving a node", () => {
  it("saves a dragged node where it was dropped, on the grid", async () => {
    const { props } = renderCanvas([at("a", 0, 0), at("b", 600, 0)]);

    drag("a");

    await waitFor(() => expect(props.onPositionChange).toHaveBeenCalledTimes(1));
    const [moved, x, y] = vi.mocked(props.onPositionChange).mock.calls[0];
    expect(moved.id).toBe("a");
    expect(x % SNAP).toBe(0);
    expect(y % SNAP).toBe(0);
    expect(x).not.toBe(0);
  });

  it("says it is saving while the server has not answered, and holds still", async () => {
    const onPositionChange = vi.fn(() => new Promise<void>(() => {}));
    renderCanvas([at("a", 0, 0), at("b", 600, 0)], { onPositionChange });

    drag("a");

    expect(await screen.findByText(/Saving graph/)).toBeInTheDocument();
    drag("b");
    expect(onPositionChange).toHaveBeenCalledTimes(1);
  });

  it("says why a move failed, in the server's words when it has them", async () => {
    const onPositionChange = vi.fn(() => Promise.reject(new Error("Someone else moved it.")));
    renderCanvas([at("a", 0, 0), at("b", 600, 0)], { onPositionChange });

    drag("a");

    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else moved it.");
    expect(screen.queryByText(/Saving graph/)).not.toBeInTheDocument();
  });

  it("falls back to its own words when the failure has none", async () => {
    const onPositionChange = vi.fn(failWithoutReason);
    renderCanvas([at("a", 0, 0), at("b", 600, 0)], { onPositionChange });

    drag("a");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The node position could not be saved.",
    );
  });

  it("does not let a read-only graph be dragged", () => {
    const { props } = renderCanvas([at("a", 0, 0), at("b", 600, 0)], { editable: false });

    drag("a");

    expect(props.onPositionChange).not.toHaveBeenCalled();
  });
});

describe("BlueprintGraphCanvas: connecting nodes", () => {
  it("makes the node it is dropped on wait for the one the line came from", async () => {
    const { props } = renderCanvas([at("a", 0, 0), at("b", 600, 0)]);

    connect("a", "b");

    await waitFor(() => expect(props.onAddBlocker).toHaveBeenCalledTimes(1));
    const [blocked, blockerId] = vi.mocked(props.onAddBlocker).mock.calls[0];
    expect(blocked.id).toBe("b");
    expect(blockerId).toBe("a");
  });

  it("refuses a connection that is already there, and says so", async () => {
    const { props } = renderCanvas([at("a", 0, 0), at("b", 600, 0, ["a"])]);

    connect("a", "b");

    expect(await screen.findByRole("alert")).toHaveTextContent("These two are already connected.");
    expect(props.onAddBlocker).not.toHaveBeenCalled();
  });

  it("refuses a connection that would make two nodes wait for each other", async () => {
    const { props } = renderCanvas([at("a", 0, 0), at("b", 600, 0, ["a"])]);

    connect("b", "a");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That would make them wait for each other, so neither could ever start.",
    );
    expect(props.onAddBlocker).not.toHaveBeenCalled();
  });

  it("says why a connection could not be saved", async () => {
    const onAddBlocker = vi.fn(failWithoutReason);
    renderCanvas([at("a", 0, 0), at("b", 600, 0)], { onAddBlocker });

    connect("a", "b");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The connection could not be saved.",
    );
  });

  it("offers no handles to draw from on a read-only graph", () => {
    renderCanvas([at("a", 0, 0), at("b", 600, 0)], { editable: false });

    expect(portEl("a")).toBeNull();
  });
});

describe("BlueprintGraphCanvas: taking a connection away", () => {
  function selectEdge() {
    const hit = document.querySelector<SVGPathElement>("path[data-canvas-control]")!;
    fireEvent.pointerDown(hit, { button: 0, pointerId: 3 });
  }

  it("removes the selected connection from the node that waited on it", async () => {
    const { props } = renderCanvas([at("a", 0, 0), at("b", 600, 0, ["a"])]);

    selectEdge();
    fireEvent.click(await screen.findByRole("button", { name: "Remove connection" }));

    await waitFor(() => expect(props.onRemoveBlocker).toHaveBeenCalledTimes(1));
    const [blocked, blockerId] = vi.mocked(props.onRemoveBlocker).mock.calls[0];
    expect(blocked.id).toBe("b");
    expect(blockerId).toBe("a");
  });

  it("says why a connection could not be removed", async () => {
    const onRemoveBlocker = vi.fn(failWithoutReason);
    renderCanvas([at("a", 0, 0), at("b", 600, 0, ["a"])], { onRemoveBlocker });

    selectEdge();
    fireEvent.click(await screen.findByRole("button", { name: "Remove connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The connection could not be removed.",
    );
  });

  it("cannot select a connection on a read-only graph", () => {
    renderCanvas([at("a", 0, 0), at("b", 600, 0, ["a"])], { editable: false });

    expect(document.querySelector("path[data-canvas-control]")).toBeNull();
  });
});

describe("BlueprintGraphCanvas: making nodes", () => {
  const kinds = [
    { id: "phase", label: "Add phase" },
    { id: "question", label: "Add question" },
  ];

  it("offers a button per kind and makes one in the middle of what is on screen", async () => {
    const onCreateNode = vi.fn<NonNullable<CanvasProps["onCreateNode"]>>(ok);
    renderCanvas([at("a", 0, 0)], { createKinds: kinds, onCreateNode });

    fireEvent.click(screen.getByRole("button", { name: "Add question" }));

    await waitFor(() => expect(onCreateNode).toHaveBeenCalledTimes(1));
    const [kind, x, y] = onCreateNode.mock.calls[0];
    expect(kind).toBe("question");
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
    expect(screen.getByRole("button", { name: "Add phase" })).toBeInTheDocument();
  });

  it("makes the first kind under the pointer on a double-click", async () => {
    const onCreateNode = vi.fn<NonNullable<CanvasProps["onCreateNode"]>>(ok);
    renderCanvas([at("a", 0, 0)], { createKinds: kinds, onCreateNode });

    fireEvent.doubleClick(screen.getByRole("application"), { clientX: 130, clientY: 70 });

    await waitFor(() => expect(onCreateNode).toHaveBeenCalledTimes(1));
    expect(onCreateNode.mock.calls[0][0]).toBe("phase");
    expect(onCreateNode.mock.calls[0][1] % SNAP).toBe(0);
  });

  it("says why a node could not be made", async () => {
    const onCreateNode = vi.fn(failWithoutReason);
    renderCanvas([at("a", 0, 0)], { createKinds: kinds, onCreateNode });

    fireEvent.click(screen.getByRole("button", { name: "Add phase" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The node could not be created.");
  });

  it("offers nothing to make on a read-only graph, or with nothing it can make", () => {
    const onCreateNode = vi.fn<NonNullable<CanvasProps["onCreateNode"]>>(ok);
    const { unmount } = renderCanvas([at("a", 0, 0)], {
      createKinds: kinds,
      onCreateNode,
      editable: false,
    });
    expect(screen.queryByRole("button", { name: "Add phase" })).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("application"));
    expect(onCreateNode).not.toHaveBeenCalled();
    unmount();

    renderCanvas([at("a", 0, 0)], { onCreateNode });
    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeInTheDocument();
  });

  it("tells an author with something to make how, and a reader nothing of the sort", () => {
    const { unmount } = renderCanvas([], { createKinds: kinds, onCreateNode: vi.fn(ok) });
    expect(screen.getByText(/Double-click anywhere here to make one/)).toBeInTheDocument();
    unmount();

    renderCanvas([], { editable: false });
    expect(screen.getByText("Nothing has been placed here yet.")).toBeInTheDocument();
  });
});

describe("BlueprintGraphCanvas: finding a node", () => {
  const five = ["a", "b", "c", "d", "e"].map((id, index) => at(id, index * 400, 0));
  const dimmed = (id: string) =>
    screen.getByTestId(`graph-node-${id}`).className.includes("opacity-35");

  it("offers a search only past four nodes", () => {
    const { unmount } = renderCanvas(five.slice(0, 4));
    expect(screen.queryByLabelText("Find a node on the canvas")).not.toBeInTheDocument();
    unmount();

    renderCanvas(five);
    expect(screen.getByLabelText("Find a node on the canvas")).toBeInTheDocument();
  });

  it("lights the matches and quietens the rest, ignoring case and padding", () => {
    renderCanvas(five);

    fireEvent.change(screen.getByLabelText("Find a node on the canvas"), {
      target: { value: "  NODE C " },
    });

    expect(dimmed("c")).toBe(false);
    expect(dimmed("a")).toBe(true);
    expect(dimmed("e")).toBe(true);
  });

  it("quietens nothing for a blank search", () => {
    renderCanvas(five);

    fireEvent.change(screen.getByLabelText("Find a node on the canvas"), {
      target: { value: "   " },
    });

    expect(five.map((n) => dimmed(n.id))).toEqual([false, false, false, false, false]);
  });

  it("leaves the search out of an embedded canvas", () => {
    renderCanvas(five, { height: "fill" });

    expect(screen.queryByLabelText("Find a node on the canvas")).not.toBeInTheDocument();
  });
});

describe("BlueprintGraphCanvas: showing only a run", () => {
  const nodes = [at("a", 0, 0), at("b", 400, 0, ["a"]), at("c", 800, 0, ["b"]), at("d", 0, 400)];

  it("has nothing to narrow to until a node is pointed at", () => {
    renderCanvas(nodes);

    expect(screen.getByRole("button", { name: "Show only the selected run" })).toBeDisabled();
  });

  it("hides every node outside the run, and brings them back", async () => {
    renderCanvas(nodes);
    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    const narrow = await screen.findByRole("button", { name: "Show only the selected run" });
    await waitFor(() => expect(narrow).toBeEnabled());
    fireEvent.click(narrow);

    await waitFor(() => expect(screen.queryByTestId("graph-node-d")).not.toBeInTheDocument());
    expect(screen.getByTestId("graph-node-a")).toBeInTheDocument();
    const wide = screen.getByRole("button", { name: "Show the whole graph again" });
    expect(wide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(wide);
    expect(await screen.findByTestId("graph-node-d")).toBeInTheDocument();
  });

  it("leaves the control out of an embedded canvas", () => {
    renderCanvas(nodes, { height: "fill" });

    expect(
      screen.queryByRole("button", { name: "Show only the selected run" }),
    ).not.toBeInTheDocument();
  });
});

/** The toolbar's own switch, not a close button the opened panel carries under the same name. */
function toolbarButton(name: string) {
  const found = screen
    .getAllByRole("button", { name })
    .find((button) => button.hasAttribute("aria-pressed"));
  if (!found) throw new Error(`no toolbar button ${name}`);
  return found;
}

describe("BlueprintGraphCanvas: the legend", () => {
  it("opens with the canvas, and is put away and brought back from the toolbar", () => {
    renderCanvas([at("a", 0, 0)]);

    const hide = toolbarButton("Hide the legend");
    expect(hide).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hide);

    const show = screen.getByRole("button", { name: "What the symbols mean" });
    expect(show).not.toHaveAttribute("aria-pressed");
    fireEvent.click(show);
    expect(toolbarButton("Hide the legend")).toBeInTheDocument();
  });

  it("is not on an embedded canvas, which is too small to spare the room", () => {
    renderCanvas([at("a", 0, 0)], { height: "fill" });

    expect(screen.queryByRole("button", { name: /legend|symbols mean/ })).not.toBeInTheDocument();
  });
});

describe("BlueprintGraphCanvas: the header", () => {
  it("heads the canvas with its title, description and action", () => {
    renderCanvas([at("a", 0, 0)], { headerAction: <button type="button">Do a thing</button> });

    expect(screen.getByRole("heading", { name: "Path graph" })).toBeInTheDocument();
    expect(screen.getByText("Arrange the phases.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do a thing" })).toBeInTheDocument();
  });

  it("draws no heading at all where nothing heads it", () => {
    renderCanvas([at("a", 0, 0)], { title: "", description: "" });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("leaves out the description when there is none", () => {
    renderCanvas([at("a", 0, 0)], { description: "" });

    expect(screen.getByRole("heading", { name: "Path graph" })).toBeInTheDocument();
    expect(screen.queryByText("Arrange the phases.")).not.toBeInTheDocument();
  });
});

describe("BlueprintGraphCanvas: accepting a tidy-up", () => {
  it("says how many cards could not be moved, and keeps the proposal open to try again", async () => {
    const onPositionChange = vi
      .fn()
      .mockRejectedValueOnce(new Error("no"))
      .mockResolvedValue(undefined);
    renderCanvas([loose("a"), loose("b", ["a"])], { onPositionChange, onCreateNode: vi.fn(ok) });

    fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep this" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 of 2 cards could not be moved. Accept again to retry them.",
    );
    expect(screen.getByRole("button", { name: "Keep this" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep this" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Keep this" })).not.toBeInTheDocument(),
    );
  });

  it("does not save a card that is already where the proposal puts it", async () => {
    const onPositionChange = vi.fn(ok);
    renderCanvas([at("a", 0, 0)], { onPositionChange, onCreateNode: vi.fn(ok) });

    fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep this" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Keep this" })).not.toBeInTheDocument(),
    );
    expect(onPositionChange.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("edits the proposal instead of saving when a card is dragged during review", () => {
    const onPositionChange = vi.fn(ok);
    renderCanvas([loose("a"), loose("b", ["a"])], { onPositionChange, onCreateNode: vi.fn(ok) });

    fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));
    drag("a");

    expect(onPositionChange).not.toHaveBeenCalled();
    expect(screen.getByText("Laid out by prerequisite")).toBeInTheDocument();
  });
});

describe("BlueprintGraphCanvas: the opened node", () => {
  function Opened({ onClose }: { onClose: () => void }) {
    return (
      <BlueprintGraphCanvas<BlueprintGraphCanvasNode>
        nodes={[at("a", 0, 0), at("b", 400, 0, ["a"])]}
        title="Path graph"
        description="d"
        editable
        onPositionChange={ok}
        onAddBlocker={ok}
        onRemoveBlocker={ok}
        renderNode={(item, cardProps) => (
          <BlueprintNodeCard
            {...cardProps}
            title={item.title}
            kind={{ label: "Phase", icon: Layers }}
          />
        )}
        openNodeId="a"
        onCloseNodeDetail={onClose}
        renderNodeDetail={(item) => ({
          title: item.title,
          body: <input aria-label="A field" />,
        })}
      />
    );
  }

  it("is closed by Escape", () => {
    const onClose = vi.fn();
    render(<Opened onClose={onClose} />);

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to a field it happens inside", () => {
    const onClose = vi.fn();
    render(<Opened onClose={onClose} />);

    fireEvent.keyDown(screen.getByLabelText("A field"), { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("is closed by its back control, and ignores other keys", () => {
    const onClose = vi.fn();
    render(<Opened onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();

    const cover = screen.getByLabelText("A field").closest("section, div[role], div");
    expect(cover).not.toBeNull();
    fireEvent.click(within(document.body).getByRole("button", { name: /back/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("BlueprintGraphCanvas: how a node is named for a screen reader", () => {
  const label = (id: string) => nodeEl(id).getAttribute("aria-label");

  it("says a node nothing has to happen before is a place to start", () => {
    renderCanvas([at("a", 0, 0), at("b", 600, 0, ["a"])]);

    expect(label("a")).toBe("Node a, nothing has to happen first");
  });

  it("says what a node waits for, by name", () => {
    renderCanvas([at("a", 0, 0), at("b", 600, 0), at("c", 1200, 0, ["a", "b"])]);

    expect(label("c")).toBe("Node c, waits for Node a, Node b");
  });
});

describe("BlueprintGraphCanvas: how the arrows of a lit run are drawn", () => {
  const nodes = [
    at("a", 0, 0),
    at("b", 500, 0, ["a"]),
    at("c", 1000, 0, ["b"]),
    at("d", 0, 500),
    at("e", 1000, 500, ["d"]),
  ];
  const edge = (key: string) => document.querySelector(`path[data-edge="${key}"]`)!;
  const classOf = (key: string) => edge(key).getAttribute("class") ?? "";

  it("draws what comes before the node being pointed at apart from what comes after", async () => {
    renderCanvas(nodes);
    expect(classOf("a->b")).toContain(EDGE_STYLE_SWATCH.rule.className);

    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    await waitFor(() => expect(classOf("b->c")).toContain("journey-edge-flow"));
    expect(classOf("a->b")).toContain(EDGE_STYLE_SWATCH.upstream.className);
    expect(classOf("a->b")).not.toContain("journey-edge-flow");
  });

  it("leaves an arrow outside the run alone", async () => {
    renderCanvas(nodes);

    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    await waitFor(() => expect(classOf("b->c")).toContain("journey-edge-flow"));
    expect(classOf("d->e")).toContain(EDGE_STYLE_SWATCH.rule.className);
    expect(classOf("d->e")).not.toContain("journey-edge-flow");
  });

  it("does not light an arrow from the run to a node that is not in it", async () => {
    renderCanvas([...nodes, at("f", 500, 500, ["a"])]);

    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    await waitFor(() => expect(classOf("b->c")).toContain("journey-edge-flow"));
    expect(classOf("a->f")).toContain(EDGE_STYLE_SWATCH.rule.className);
  });

  it("lets the caller say how firm an arrow is while nothing is pointed at", () => {
    const edgeTone = vi.fn((node: BlueprintGraphCanvasNode) =>
      node.id === "c" ? ("active" as const) : ("rule" as const),
    );
    renderCanvas(nodes, { edgeTone });

    expect(classOf("b->c")).toContain("journey-edge-flow");
    expect(classOf("a->b")).not.toContain("journey-edge-flow");
    expect(edgeTone).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }), "b");
  });

  it("lets the pointed-at run win over the caller's tone", async () => {
    renderCanvas(nodes, { edgeTone: () => "active" });

    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    await waitFor(() => expect(classOf("a->b")).toContain(EDGE_STYLE_SWATCH.upstream.className));
  });
});

describe("BlueprintGraphCanvas: where a step goes from an opened node", () => {
  function opened(openNodeId: string, nodes: BlueprintGraphCanvasNode[]) {
    const onNavigateNodeDetail = vi.fn();
    renderCanvas(nodes, {
      openNodeId,
      onCloseNodeDetail: vi.fn(),
      onNavigateNodeDetail,
      renderNodeDetail: (item) => ({ title: item.title, body: <p>Fields for {item.title}</p> }),
    });
    return { onNavigateNodeDetail };
  }

  it("falls back to the author's own order where nothing is connected", () => {
    opened("b", [at("a", 0, 0), at("b", 500, 0), at("c", 1000, 0)]);

    expect(screen.getByRole("button", { name: "Previous: Node a" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next: Node c" })).toBeEnabled();
  });

  it("has nothing before the first node and nothing after the last", () => {
    opened("a", [at("a", 0, 0), at("b", 500, 0)]);
    expect(screen.getByRole("button", { name: "Nothing before this one" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next: Node b" })).toBeEnabled();
  });

  it("has nothing after the last node", () => {
    opened("b", [at("a", 0, 0), at("b", 500, 0)]);

    expect(screen.getByRole("button", { name: "Nothing after this one" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous: Node a" })).toBeEnabled();
  });

  it("goes back to the last thing the author said it waits for, and on to the first thing it opens", () => {
    opened("c", [
      at("a", 0, 0),
      at("b", 500, 0),
      at("c", 1000, 0, ["a", "b"]),
      at("d", 1500, 0, ["c"]),
      at("e", 2000, 0, ["c"]),
    ]);

    expect(screen.getByRole("button", { name: "Waits for: Node b" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Opens: Node d" })).toBeEnabled();
  });

  it("asks the caller to go there rather than going", () => {
    const { onNavigateNodeDetail } = opened("b", [
      at("a", 0, 0),
      at("b", 500, 0),
      at("c", 1000, 0),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Previous: Node a" }));
    fireEvent.click(screen.getByRole("button", { name: "Next: Node c" }));

    expect(onNavigateNodeDetail).toHaveBeenNthCalledWith(1, "a");
    expect(onNavigateNodeDetail).toHaveBeenNthCalledWith(2, "c");
  });

  it("steps back on a swipe the other way", async () => {
    const { onNavigateNodeDetail } = opened("b", [
      at("a", 0, 0),
      at("b", 500, 0),
      at("c", 1000, 0),
    ]);
    const surface = screen.getByRole("dialog", { name: "Node b" }).parentElement as HTMLElement;

    fireEvent.wheel(surface, { deltaX: -60, deltaY: 0 });

    await waitFor(() => expect(onNavigateNodeDetail).toHaveBeenCalledWith("a"));
  });

  it("opens a node by asking the caller, not the camera, when there is no page to open it into", () => {
    const onNodeClick = vi.fn();
    renderCanvas([at("a", 0, 0), at("b", 500, 0)], { onNodeClick });

    const element = screen.getByTestId("graph-node-a");
    fireEvent.pointerDown(element, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(element, { button: 0, pointerId: 1 });

    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(onNodeClick.mock.calls[0][0].id).toBe("a");
  });
});
