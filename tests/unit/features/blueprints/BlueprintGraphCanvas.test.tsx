import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNode,
} from "../../../../src/features/blueprints/components/BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "../../../../src/features/blueprints/components/BlueprintNodeCard.tsx";
import { LOCK_SENTENCE } from "../../../../src/features/graph-diagram/lockWords.ts";

/**
 * Nodes are addressed by the test id the canvas puts on each wrapper, and a control inside one by
 * its text or its label attribute. The canvas draws its own nodes as plain HTML, so they are
 * visible to role queries — but the test id is what stays true when the card inside changes.
 */
function node(id: string, blockerIds: string[] = [], placed = true): BlueprintGraphCanvasNode {
  return {
    id,
    title: `Node ${id}`,
    graphX: placed ? 0 : null,
    graphY: placed ? 0 : null,
    blockerIds,
  };
}

/** A node at a coordinate of its own, the way a blueprint authored on a free canvas stores them. */
function at(id: string, x: number, y: number, blockerIds: string[] = []): BlueprintGraphCanvasNode {
  return { ...node(id, blockerIds), graphX: x, graphY: y };
}

/** The one drawn arrow, as its start, its two control points and where it lands. */
function onlyEdge() {
  const shape = [...document.querySelectorAll("path[data-edge]")]
    .map((path) => path.getAttribute("d") ?? "")
    .map((d) =>
      /^M (-?[\d.]+) (-?[\d.]+) C (-?[\d.]+) (-?[\d.]+), (-?[\d.]+) (-?[\d.]+), (-?[\d.]+) (-?[\d.]+)/.exec(
        d,
      ),
    )
    .find((match): match is RegExpExecArray => match !== null);
  if (!shape) throw new Error("no edge drawn");
  const [, ...numbers] = shape;
  const [x, y, c1x, c1y, c2x, c2y, endX, endY] = numbers.map(Number);
  return {
    start: { x, y },
    control: [
      { x: c1x, y: c1y },
      { x: c2x, y: c2y },
    ],
    end: { x: endX, y: endY },
  };
}

/** Where every drawn arrow starts, read off the edges' own paths. */
function edgeStarts(): { x: number; y: number }[] {
  return [...document.querySelectorAll("path[data-edge]")]
    .map((path) => /^M (-?[\d.]+) (-?[\d.]+)/.exec(path.getAttribute("d") ?? ""))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

const noop = () => Promise.resolve();

/**
 * The canvas as the Blueprint editors drive it: a node opens into the canvas, and the caller holds
 * which one is open so that it can refuse to let go of one with unsaved fields.
 */
function OpenableCanvas({ canNavigate = false }: { canNavigate?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <BlueprintGraphCanvas<BlueprintGraphCanvasNode>
      nodes={[node("a"), node("b", ["a"]), node("c", ["b"])]}
      title="Path graph"
      description="Arrange the phases."
      editable
      onNodeClick={(clicked) => setOpenId(clicked.id)}
      onPositionChange={noop}
      onAddBlocker={noop}
      onRemoveBlocker={noop}
      renderNode={(item, cardProps) => (
        <BlueprintNodeCard
          {...cardProps}
          title={item.title}
          kind={{ label: "Phase", icon: Layers }}
        />
      )}
      openNodeId={openId}
      onCloseNodeDetail={() => setOpenId(null)}
      onNavigateNodeDetail={canNavigate ? (id) => setOpenId(id) : undefined}
      renderNodeDetail={(item) => ({ title: item.title, body: <p>Fields for {item.title}</p> })}
    />
  );
}

/**
 * A click on a node, as the canvas hears one.
 *
 * The canvas runs on pointer events rather than on `click`, because the same gesture that selects a
 * node is the one that drags it somewhere — so a plain `fireEvent.click` reaches nothing.
 */
function clickNode(id: string) {
  const element = screen.getByTestId(`graph-node-${id}`);
  fireEvent.pointerDown(element, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, pointerId: 1 });
}

function renderCanvas(
  nodes: BlueprintGraphCanvasNode[],
  over: Partial<Parameters<typeof BlueprintGraphCanvas<BlueprintGraphCanvasNode>>[0]> = {},
) {
  const props = {
    nodes,
    title: "Path graph",
    description: "Arrange the phases.",
    editable: true,
    onNodeClick: vi.fn(),
    onPositionChange: noop,
    onAddBlocker: noop,
    onRemoveBlocker: noop,
    renderNode: (
      item: BlueprintGraphCanvasNode,
      cardProps: Parameters<
        NonNullable<
          Parameters<typeof BlueprintGraphCanvas<BlueprintGraphCanvasNode>>[0]["renderNode"]
        >
      >[1],
    ) => (
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

describe("BlueprintGraphCanvas", () => {
  it("names itself for screen readers", () => {
    renderCanvas([node("a")]);

    expect(screen.getByRole("application", { name: "Blueprint graph canvas" })).toBeInTheDocument();
  });

  it("draws every placed node", () => {
    renderCanvas([node("a"), node("b", ["a"])]);

    expect(screen.getByTestId("graph-node-a")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-b")).toBeInTheDocument();
  });

  it("draws a node that has never been placed, rather than hiding it in a panel", () => {
    // A phase with no stored coordinate is in the blueprint and reaches every hire. The panel that
    // used to hold these read as a staging area for things that were not, which was false.
    renderCanvas([node("a"), node("b", [], false)]);

    expect(screen.getByTestId("graph-node-a")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-b")).toBeInTheDocument();
  });

  it("draws a node with no library to put it in, so a read-only graph is never empty", () => {
    renderCanvas([node("a", [], false)], { editable: false });

    expect(screen.getByTestId("graph-node-a")).toBeInTheDocument();
  });

  it("marks a node nothing has to happen before", () => {
    renderCanvas([node("a"), node("b", ["a"])]);

    expect(within(screen.getByTestId("graph-node-a")).getByText("Start")).toBeInTheDocument();
    expect(within(screen.getByTestId("graph-node-b")).queryByText("Start")).not.toBeInTheDocument();
  });

  it("says nothing at all about order when nothing sequences a node", () => {
    // "No fixed order" used to sit on every card of every graph nobody had connected, which is to
    // say on all of them. A badge that never varies distinguishes nothing and cost a row to say so.
    renderCanvas([node("a"), node("loner")]);

    expect(
      within(screen.getByTestId("graph-node-loner")).queryByText(/of \d+$/),
    ).not.toBeInTheDocument();
  });

  it("numbers a node inside the chain it belongs to", () => {
    renderCanvas([node("a"), node("b", ["a"]), node("c", ["b"])]);

    expect(within(screen.getByTestId("graph-node-b")).getByText("2 of 3")).toBeInTheDocument();
  });

  it("explains what an arrow means, because one relation unexplained reads as a suggestion", () => {
    renderCanvas([node("a")]);

    // Read from the shared wording rather than restated: this sentence is the one place three
    // surfaces agree on what an arrow is, and a test with its own copy would hide a drift.
    expect(screen.getByText(LOCK_SENTENCE)).toBeInTheDocument();
  });

  it("tells an author how to reach a node, and a reader nothing of the sort", () => {
    const { unmount } = renderCanvas([node("a")]);
    expect(screen.getByText(/Click a node to edit it/)).toBeInTheDocument();
    unmount();

    renderCanvas([node("a")], { editable: false });
    expect(screen.queryByText(/Click a node to edit it/)).not.toBeInTheDocument();
  });

  it("offers the tools that change the graph only while it can be changed", () => {
    const { unmount } = renderCanvas([node("a")], { onCreateNode: noop });
    expect(screen.getByRole("button", { name: "Tidy up" })).toBeInTheDocument();
    unmount();

    renderCanvas([node("a")], { editable: false });
    expect(screen.queryByRole("button", { name: "Tidy up" })).not.toBeInTheDocument();
  });

  it("offers a new arrangement rather than applying one, because nothing else here can be undone", async () => {
    const onPositionChange = vi.fn(() => Promise.resolve());
    renderCanvas([node("a"), node("b", ["a"])], { onPositionChange, onCreateNode: noop });

    fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));

    expect(screen.getByText("Laid out by prerequisite")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is saved yet/)).toBeInTheDocument();
    expect(onPositionChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep this" }));

    await waitFor(() => expect(onPositionChange).toHaveBeenCalled());
  });

  it("puts the old arrangement back, and saves nothing on the way", async () => {
    const onPositionChange = vi.fn(() => Promise.resolve());
    renderCanvas([node("a"), node("b", ["a"])], { onPositionChange, onCreateNode: noop });

    fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));
    fireEvent.click(screen.getByRole("button", { name: "Put it back" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tidy up" })).toBeInTheDocument(),
    );
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("counts both halves of a run when a node is pointed at", async () => {
    renderCanvas([node("a"), node("b", ["a"]), node("c", ["b"])]);

    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    // The two numbers a picture cannot be counted for, and the ones that decide whether a node is
    // worth doing early.
    await waitFor(() => expect(screen.getByText("1 must happen first")).toBeInTheDocument());
    expect(screen.getByText("Finishing it opens 1")).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId("graph-node-b"));
    await waitFor(() => expect(screen.queryByText("1 must happen first")).not.toBeInTheDocument());
  });

  it("says plainly when a node has nothing on one side, rather than showing a zero", () => {
    renderCanvas([node("a"), node("b", ["a"])]);

    fireEvent.mouseEnter(screen.getByTestId("graph-node-a"));

    expect(screen.getByText("Nothing has to happen first")).toBeInTheDocument();
  });

  it("moves between nodes from the keyboard, which is the only way some people can", async () => {
    renderCanvas([node("a"), node("b", ["a"]), node("c", ["b"])]);

    const pane = screen.getByTestId("blueprint-graph-canvas");
    // The first press picks a node up rather than moving from nowhere.
    fireEvent.keyDown(pane, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByText("Nothing has to happen first")).toBeInTheDocument(),
    );

    fireEvent.keyDown(pane, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("1 must happen first")).toBeInTheDocument());
  });

  it("leaves an arrow key alone inside a field, where it is a cursor", async () => {
    renderCanvas([node("a"), node("b", ["a"]), node("c"), node("d"), node("e")], {
      onCreateNode: noop,
    });

    const search = screen.getByRole("textbox", { name: "Find a node on the canvas" });
    fireEvent.keyDown(search, { key: "ArrowRight" });

    await waitFor(() => expect(screen.queryByText(/must happen first/)).not.toBeInTheDocument());
  });

  it("offers a way through a crowded graph, and does not clutter a small one", () => {
    const { unmount } = renderCanvas([node("a"), node("b"), node("c"), node("d"), node("e")]);
    expect(screen.getByRole("textbox", { name: "Find a node on the canvas" })).toBeInTheDocument();
    unmount();

    renderCanvas([node("a"), node("b")]);
    expect(
      screen.queryByRole("textbox", { name: "Find a node on the canvas" }),
    ).not.toBeInTheDocument();
  });

  it("fits the box it is given rather than overflowing it", () => {
    // The bug this prop exists for: a canvas that insists on 34rem inside a 10rem strip does not
    // shrink, it overflows — and paints itself over every card under it on the board.
    const { unmount } = renderCanvas([node("a")], { height: "fill" });
    const surface = screen.getByTestId("blueprint-graph-canvas").parentElement as HTMLElement;
    expect(surface.className).toContain("flex-1");
    expect(surface.className).not.toContain("clamp");
    unmount();

    renderCanvas([node("a")]);
    expect(
      (screen.getByTestId("blueprint-graph-canvas").parentElement as HTMLElement).className,
    ).toContain("clamp");
  });

  it("leaves its furniture behind when it is embedded in something else", () => {
    // A minimap, a zoom column and a legend panel in a strip a few hundred pixels tall cover the
    // thing they are there to help with.
    renderCanvas([node("a"), node("b", ["a"])], { height: "fill" });

    expect(screen.queryByRole("button", { name: "Graph overview" })).not.toBeInTheDocument();
    expect(screen.queryByText(LOCK_SENTENCE)).not.toBeInTheDocument();
  });

  it("tells the two halves of a lit run apart, rather than lighting them as one blob", async () => {
    // The question somebody asks by pointing at a node is "what is in my way, and what am I in the
    // way of". Lighting the whole run answers neither half.
    renderCanvas([node("a"), node("b", ["a"]), node("c", ["b"]), node("loner")]);

    fireEvent.mouseEnter(screen.getByTestId("graph-node-b"));

    await waitFor(() =>
      expect(screen.getByTestId("graph-node-b")).toHaveAttribute("data-chain-half", "focus"),
    );
    expect(screen.getByTestId("graph-node-a")).toHaveAttribute("data-chain-half", "behind");
    expect(screen.getByTestId("graph-node-c")).toHaveAttribute("data-chain-half", "ahead");
    expect(screen.getByTestId("graph-node-loner")).not.toHaveAttribute("data-chain-half");
  });

  it("opens a node into the canvas rather than beside it", async () => {
    render(<OpenableCanvas />);
    clickNode("a");

    // The camera flies in first, so the page appears once it has landed rather than over a graph
    // still on its way there.
    await waitFor(() => expect(screen.getByText("Fields for Node a")).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Node a" })).toBeInTheDocument();

    // Pressing beside the page closes it — the gesture nobody has to be taught, and the reason
    // there is no shrink-back glyph in the corner any more.
    const backdrop = screen.getByRole("region", { name: "Node a" }).parentElement as HTMLElement;
    fireEvent.pointerDown(backdrop);
    await waitFor(() => expect(screen.queryByText("Fields for Node a")).not.toBeInTheDocument());

    clickNode("a");
    await waitFor(() => expect(screen.getByText("Fields for Node a")).toBeInTheDocument());
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Fields for Node a")).not.toBeInTheDocument());
  });

  it("offers a step either side of an opened node, and says where each one goes", async () => {
    // Two bare chevrons say "there is more this way", which is the one thing somebody already
    // knew. The relation in front of the title says whether this is the blueprint's own order or
    // merely the author's list order.
    render(<OpenableCanvas canNavigate />);
    clickNode("b");
    await waitFor(() => expect(screen.getByText("Fields for Node b")).toBeInTheDocument());

    const steps = screen.getByRole("navigation", { name: "Steps either side of this one" });
    expect(within(steps).getByRole("button", { name: "Waits for: Node a" })).toBeInTheDocument();

    fireEvent.click(within(steps).getByRole("button", { name: "Opens: Node c" }));
    await waitFor(() => expect(screen.getByText("Fields for Node c")).toBeInTheDocument());
  });

  it("takes a sideways swipe across the page as the same step", async () => {
    // The graph under it marks the whole pane as somewhere the page's own swipe must not go,
    // because a swipe there pans the canvas. A page drawn on top of it is not the canvas.
    render(<OpenableCanvas canNavigate />);
    clickNode("b");
    await waitFor(() => expect(screen.getByText("Fields for Node b")).toBeInTheDocument());

    const surface = screen.getByRole("region", { name: "Node b" }).parentElement as HTMLElement;
    fireEvent.wheel(surface, { deltaX: 60, deltaY: 0 });

    await waitFor(() => expect(screen.getByText("Fields for Node c")).toBeInTheDocument());
  });

  it("leaves the steps out where nothing can move between nodes", async () => {
    render(<OpenableCanvas />);
    clickNode("b");
    await waitFor(() => expect(screen.getByText("Fields for Node b")).toBeInTheDocument());

    expect(
      screen.queryByRole("navigation", { name: "Steps either side of this one" }),
    ).not.toBeInTheDocument();
  });

  it("leaves sideways when what a node waits on is not above it", () => {
    // Stored coordinates come off a free canvas, so a phase can sit above the thing it waits on. A
    // downward curve between those two ends doubles back and runs under both cards — cards are
    // drawn over edges — and all that is left on screen is an arrowhead beside a card with no line
    // attached to it, which is what this looked like.
    renderCanvas([at("a", 0, 300), at("b", 0, 0, ["a"])]);

    // Level with the blocker's middle, not below its bottom edge: the arrow goes out of its side.
    expect(edgeStarts()).toContainEqual(expect.objectContaining({ y: 300 }));
  });

  it("still drops out of the bottom of a node that really is above", () => {
    renderCanvas([at("a", 0, 0), at("b", 0, 300, ["a"])]);

    // Half a card below the blocker's middle, which is its bottom edge.
    expect(edgeStarts()).toContainEqual({ x: 0, y: 54 });
  });

  it("never overshoots the end it is aiming at", () => {
    // A fixed minimum bend makes a long edge leave and arrive straight instead of cutting the
    // corner. On a short one it puts the control point past the far end, and the curve dips
    // through the card it was aiming at and comes back out to meet its own arrowhead — which is
    // what the line disappearing into a card and reappearing under it was.
    renderCanvas([at("a", 0, 0), at("b", 0, 140, ["a"])]);

    const edge = onlyEdge();
    expect(edge.control[0].y).toBeLessThanOrEqual(edge.end.y);
    expect(edge.control[1].y).toBeGreaterThanOrEqual(edge.start.y);
  });

  it("goes around a card sitting right under another, where no line would fit between them", () => {
    // 120px apart on 108px-tall cards: a lower centre, but no row between them to run a line
    // through and no bottom edge to leave from that is not already inside the other card.
    renderCanvas([at("a", 0, 0), at("b", 0, 120, ["a"])]);

    const edge = onlyEdge();
    // Out of one side and back in on the same one, level with both cards' middles.
    expect(edge.start).toEqual({ x: 112, y: 0 });
    expect(edge.end).toEqual({ x: 118, y: 120 });
  });

  it("draws the arrowhead in the line's own ink, at its end", () => {
    // As two strokes of the edge rather than as an SVG marker. A marker is a separate drawing
    // pinned to the path's end — scaled by the stroke width rather than drawn at it, left floating
    // clear of the last dash on a dashed line, and on screen with no line under it whenever it and
    // the path disagree about where the path finishes.
    renderCanvas([at("a", 0, 0), at("b", 0, 300, ["a"])]);

    const edge = onlyEdge();
    const heads = [...document.querySelectorAll("svg path:not([data-edge]):not([stroke])")]
      .map((path) => path.getAttribute("d") ?? "")
      .filter((d) => /^M .* L .* L /.test(d));
    expect(heads).toHaveLength(1);

    // Both strokes of the head meet at the point the line stops at.
    const [, tipX, tipY] = /L (-?[\d.]+) (-?[\d.]+) L/.exec(heads[0])!;
    expect({ x: Number(tipX), y: Number(tipY) }).toEqual(edge.end);
  });

  it("says an empty canvas is empty, not broken, and says what to do about it", () => {
    const empty = renderCanvas([], {
      onCreateNode: noop,
      createKinds: [{ id: "phase", label: "New phase" }],
    });
    expect(screen.getByText("Nothing on the canvas yet")).toBeInTheDocument();
    expect(screen.getByText(/Double-click anywhere here/)).toBeInTheDocument();
    empty.unmount();

    // A reader cannot make one, so telling them how would be an instruction they cannot follow.
    const readOnly = renderCanvas([], { editable: false });
    expect(screen.getByText("Nothing has been placed here yet.")).toBeInTheDocument();
    readOnly.unmount();

    renderCanvas([node("a")]);
    expect(screen.queryByText("Nothing on the canvas yet")).not.toBeInTheDocument();
  });
});
