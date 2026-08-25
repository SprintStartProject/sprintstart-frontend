import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeProps } from "@xyflow/react";
import { DiagramCanvas } from "../../../../src/features/graph-diagram/DiagramCanvas";

type TestNodeData = { label: string; dimmed?: boolean };

/** A node that reports the one thing the canvas injects, so the chain logic is observable. */
function TestNode({ id, data }: NodeProps) {
  const { label, dimmed } = data as TestNodeData;
  return (
    <div data-testid={`node-${id}`} data-dimmed={dimmed ? "true" : "false"}>
      {label}
    </div>
  );
}

const nodeTypes = { test: TestNode };

const shape = {
  nodes: [{ key: "a" }, { key: "b" }, { key: "c" }],
  edges: [{ from: "a", to: "b" }],
};

function renderCanvas(over: Partial<Parameters<typeof DiagramCanvas<TestNodeData>>[0]> = {}) {
  const props = {
    shape,
    nodes: [
      { id: "a", data: { label: "A" }, ariaLabel: "A" },
      { id: "b", data: { label: "B" }, ariaLabel: "B" },
      { id: "c", data: { label: "C" }, ariaLabel: "C" },
    ],
    edges: [{ id: "a->b", from: "a", to: "b" }],
    nodeTypes,
    nodeType: "test",
    selectedId: null,
    onSelect: vi.fn(),
    ariaLabel: "Test diagram",
    testId: "test-diagram",
    ...over,
  };
  return { ...props, ...render(<DiagramCanvas<TestNodeData> {...props} />) };
}

describe("DiagramCanvas", () => {
  it("names itself for screen readers", () => {
    renderCanvas();

    expect(screen.getByRole("application", { name: "Test diagram" })).toBeInTheDocument();
  });

  it("dims nothing until something is selected or hovered", () => {
    renderCanvas();

    expect(screen.getByTestId("node-a")).toHaveAttribute("data-dimmed", "false");
    expect(screen.getByTestId("node-c")).toHaveAttribute("data-dimmed", "false");
  });

  it("selecting a node lights its chain and fades the rest", () => {
    renderCanvas({ selectedId: "b" });

    // Hover is pointer-only, so selection has to light the same chain — otherwise reading the
    // diagram this way is unavailable by keyboard.
    expect(screen.getByTestId("node-b")).toHaveAttribute("data-dimmed", "false");
    expect(screen.getByTestId("node-a")).toHaveAttribute("data-dimmed", "false");
    expect(screen.getByTestId("node-c")).toHaveAttribute("data-dimmed", "true");
  });

  it("an edge pointing outside the diagram is dropped, not drawn to a phantom node", () => {
    renderCanvas({
      edges: [
        { id: "a->b", from: "a", to: "b" },
        { id: "a->gone", from: "a", to: "gone" },
      ],
    });

    // React Flow would invent the missing endpoint rather than fail.
    expect(screen.getByTestId("node-a")).toBeInTheDocument();
    expect(screen.queryByTestId("node-gone")).not.toBeInTheDocument();
  });

  it("renders every node it is given", () => {
    renderCanvas();

    expect(screen.getByTestId("node-a")).toHaveTextContent("A");
    expect(screen.getByTestId("node-b")).toHaveTextContent("B");
    expect(screen.getByTestId("node-c")).toHaveTextContent("C");
  });
});
