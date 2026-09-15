import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import {
  BlueprintGraphCanvas,
  type BlueprintGraphCanvasNode,
} from "../../../../src/features/blueprints/components/BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "../../../../src/features/blueprints/components/BlueprintNodeCard.tsx";

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

    expect(
      screen.getByText(/An arrow is a lock: the node it points at stays closed/),
    ).toBeInTheDocument();
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
});
