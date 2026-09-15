import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNode,
} from "../../../../src/features/blueprints/components/BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "../../../../src/features/blueprints/components/BlueprintNodeCard.tsx";
import { LOCK_SENTENCE } from "../../../../src/features/graph-diagram/lockWords.ts";

/**
 * React Flow never measures anything in jsdom, so it leaves every node `visibility: hidden`.
 * Testing Library skips hidden elements in role queries, and computes an empty accessible name for
 * them even with `hidden: true` — so nodes are addressed by the test id the canvas puts on each
 * wrapper, and a control inside one by its text or its label attribute.
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

function renderCanvas(
  nodes: BlueprintGraphCanvasNode[],
  over: Partial<Parameters<typeof BlueprintGraphCanvas<BlueprintGraphCanvasNode>>[0]> = {},
) {
  const props = {
    nodes,
    title: "Path graph",
    description: "Arrange the phases.",
    libraryTitle: "Phases",
    libraryDescription: "Drag nodes onto the canvas.",
    libraryEmptyMessage: "All phases are on the canvas.",
    editable: true,
    onNodeClick: vi.fn(),
    onPositionChange: noop,
    onRemoveNode: noop,
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

  it("keeps an unplaced node in the library rather than on the canvas", () => {
    renderCanvas([node("a"), node("b", [], false)]);

    expect(screen.getByTestId("graph-node-a")).toBeInTheDocument();
    expect(screen.queryByTestId("graph-node-b")).not.toBeInTheDocument();
  });

  it("draws a node with no library to put it in, so a read-only graph is never empty", () => {
    renderCanvas([node("a", [], false)], { editable: false, showLibrary: false });

    expect(screen.getByTestId("graph-node-a")).toBeInTheDocument();
  });

  it("marks a node nothing has to happen before", () => {
    renderCanvas([node("a"), node("b", ["a"])]);

    expect(within(screen.getByTestId("graph-node-a")).getByText("Start")).toBeInTheDocument();
    expect(within(screen.getByTestId("graph-node-b")).queryByText("Start")).not.toBeInTheDocument();
  });

  it("says a node is in no particular order when nothing sequences it", () => {
    renderCanvas([node("a"), node("loner")]);

    expect(
      within(screen.getByTestId("graph-node-loner")).getByText("No fixed order"),
    ).toBeInTheDocument();
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

    renderCanvas([node("a")], { editable: false, showLibrary: false });
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
    const { unmount } = renderCanvas([node("a")], { onCreateFromLibrary: noop });
    expect(screen.getByRole("button", { name: "Tidy up" })).toBeInTheDocument();
    unmount();

    renderCanvas([node("a")], { editable: false, showLibrary: false });
    expect(screen.queryByRole("button", { name: "Tidy up" })).not.toBeInTheDocument();
  });

  it("offers a new arrangement rather than applying one, because nothing else here can be undone", async () => {
    const onPositionChange = vi.fn(() => Promise.resolve());
    renderCanvas([node("a"), node("b", ["a"])], { onPositionChange, onCreateFromLibrary: noop });

    fireEvent.click(screen.getByRole("button", { name: "Tidy up" }));

    expect(screen.getByText("Laid out by prerequisite")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is saved yet/)).toBeInTheDocument();
    expect(onPositionChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep this" }));

    await waitFor(() => expect(onPositionChange).toHaveBeenCalled());
  });

  it("puts the old arrangement back, and saves nothing on the way", async () => {
    const onPositionChange = vi.fn(() => Promise.resolve());
    renderCanvas([node("a"), node("b", ["a"])], { onPositionChange, onCreateFromLibrary: noop });

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

  it("says an empty canvas is empty, not broken", () => {
    const empty = renderCanvas([]);
    expect(screen.getByText("Nothing on the canvas yet")).toBeInTheDocument();
    expect(screen.getByText(/drag a new one onto the canvas/)).toBeInTheDocument();
    empty.unmount();

    // With something already in the library, the way forward is that, not creating another.
    const withLibrary = renderCanvas([node("a", [], false)]);
    expect(screen.getByText(/drag one onto the canvas/)).toBeInTheDocument();
    withLibrary.unmount();

    renderCanvas([node("a")]);
    expect(screen.queryByText("Nothing on the canvas yet")).not.toBeInTheDocument();
  });
});
