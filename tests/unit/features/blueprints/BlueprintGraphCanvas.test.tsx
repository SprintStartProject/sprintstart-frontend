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

const noop = () => Promise.resolve();

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

  it("offers a way into a node only where there is something to open", () => {
    // Queried by label attribute rather than accessible name: a React Flow node is left
    // `visibility: hidden` until it has been measured, and the name computation returns "" for
    // anything hidden — so `getByRole(..., { name })` finds nothing inside one under jsdom.
    const openControl = (nodeId: string) =>
      screen.getByTestId(`graph-node-${nodeId}`).querySelector('[aria-label^="Open "]');

    const { unmount } = renderCanvas([node("a")], { onOpenNode: vi.fn() });
    expect(openControl("a")).toHaveAttribute("aria-label", "Open Node a");
    unmount();

    renderCanvas([node("a")]);
    expect(openControl("a")).toBeNull();
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
    function Harness() {
      const [openId, setOpenId] = useState<string | null>(null);
      return (
        <BlueprintGraphCanvas<BlueprintGraphCanvasNode>
          nodes={[node("a"), node("b", ["a"])]}
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
          renderNodeDetail={(item) => ({ title: item.title, body: <p>Fields for {item.title}</p> })}
        />
      );
    }

    render(<Harness />);
    clickNode("a");

    // The camera flies in first, so the page appears once it has landed rather than over a graph
    // still on its way there.
    await waitFor(() => expect(screen.getByText("Fields for Node a")).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Node a" })).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Fields for Node a")).not.toBeInTheDocument());
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
