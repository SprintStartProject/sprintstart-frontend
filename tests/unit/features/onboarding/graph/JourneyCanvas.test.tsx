import { act, createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JourneyCanvas,
  type JourneyCameraHandle,
} from "../../../../../src/features/onboarding/graph/JourneyCanvas";
import type { LayoutNode } from "../../../../../src/features/onboarding/graph/layout";

type Item = LayoutNode & { title: string };

const NODE = { width: 200, height: 80 };

const item = (id: string, blockerIds: string[] = []): Item => ({
  id,
  title: `Node ${id}`,
  blockerIds,
});

/** Two nodes joined by an edge, and a third alone beside them. */
const TRIO = [item("a"), item("b", ["a"]), item("c")];
const TRIO_PLACES = new Map([
  ["a", { x: 0, y: 0 }],
  ["b", { x: 0, y: 200 }],
  ["c", { x: 400, y: 100 }],
]);

const QUARTET = [...TRIO, item("d", ["c"])];
const QUARTET_PLACES = new Map(TRIO_PLACES).set("d", { x: 400, y: 300 });

type Props = Parameters<typeof JourneyCanvas<Item>>[0];

function renderCanvas(over: Partial<Props> = {}) {
  const props: Props = {
    nodes: TRIO,
    positions: TRIO_PLACES,
    nodeSize: NODE,
    nodeLabel: (node) => node.title,
    renderNode: (node, state) => (
      <div
        data-testid={`card-${node.id}`}
        data-emphasis={state.emphasis}
        data-dragging={state.dragging}
      >
        {node.title}
      </div>
    ),
    ariaLabel: "Journey",
    fitKey: "one",
    ...over,
  };
  return { props, ...render(<JourneyCanvas<Item> {...props} />) };
}

const canvas = () => screen.getByRole("application");
const nodeEl = (id: string) => document.querySelector<HTMLElement>(`[data-journey-node="${id}"]`)!;
const portEl = (id: string) => document.querySelector<HTMLElement>(`[data-port-for="${id}"]`)!;
const edgeEls = () => [...document.querySelectorAll<SVGPathElement>("[data-edge]")];

/** Where the world layer is: the offset and zoom the canvas has put on it. */
function view() {
  const world = canvas().firstElementChild as HTMLElement;
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(
    world.style.transform,
  )!;
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}

const zoomLabel = () => screen.getByRole("button", { name: "Reset zoom to 100%" }).textContent;

function press(target: Element, init: KeyboardEventInit) {
  fireEvent.keyDown(target, init);
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1000 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
});

afterEach(() => {
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

describe("JourneyCanvas rendering", () => {
  it("draws every node and the edge between two of them", () => {
    renderCanvas();
    expect(screen.getByTestId("card-a")).toBeInTheDocument();
    expect(screen.getByTestId("card-c")).toBeInTheDocument();
    expect(edgeEls().map((edge) => edge.dataset.edge)).toEqual(["a->b"]);
  });

  it("fits the graph to the canvas when it first has a size", () => {
    renderCanvas();
    const { x, y, zoom } = view();
    expect(zoom).toBe(1);
    expect(x).toBeCloseTo(500 - 200, 5);
    expect(y).toBeCloseTo(300 - 100, 5);
  });

  it("makes nodes buttons only where there is something to do with them", () => {
    const { unmount } = renderCanvas();
    expect(screen.queryByRole("button", { name: "Node a" })).toBeNull();
    unmount();
    renderCanvas({ onSelect: vi.fn() });
    expect(screen.getByRole("button", { name: "Node a" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks the selected node as pressed", () => {
    renderCanvas({ onSelect: vi.fn(), selectedId: "b" });
    expect(screen.getByRole("button", { name: "Node b" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows what the owner lays over it", () => {
    renderCanvas({
      overlay: <p>Legend</p>,
      aside: <p>Details</p>,
      toolbar: <button type="button">Extra</button>,
    });
    expect(screen.getByText("Legend")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extra" })).toBeInTheDocument();
  });

  it("makes the graph inert while a node is open over it", () => {
    renderCanvas({ cover: <p>Page</p>, overlay: <p>Legend</p>, aside: <p>Details</p> });
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(canvas()).toHaveAttribute("inert");
    expect(screen.getByText("Legend").closest("[data-canvas-control]")).toHaveAttribute("inert");
    expect(screen.getByText("Details").closest("[data-canvas-control]")).toHaveAttribute("inert");
  });

  it("leaves the graph usable when nothing is open over it", () => {
    renderCanvas({ overlay: <p>Legend</p> });
    expect(canvas()).not.toHaveAttribute("inert");
  });

  it("uses the height class it is given", () => {
    const { container } = renderCanvas({ heightClassName: "h-40" });
    expect(container.firstElementChild).toHaveClass("h-40");
  });

  it("draws an edge as done, active, waiting or upstream", () => {
    renderCanvas({ edgeTone: () => "active" });
    expect(edgeEls()[0].getAttribute("class")).toContain("journey-edge-flow");
  });
});

describe("JourneyCanvas selecting and opening", () => {
  it("selects the node that is clicked", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    fireEvent.pointerDown(nodeEl("a"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(nodeEl("a"), { pointerId: 1, clientX: 5, clientY: 5 });
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("unselects the selected node when it is clicked again", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect, selectedId: "a" });
    fireEvent.pointerDown(nodeEl("a"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(nodeEl("a"), { pointerId: 1, clientX: 5, clientY: 5 });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clears the selection when the background is clicked", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect, selectedId: "a" });
    fireEvent.pointerDown(canvas(), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 5, clientY: 5 });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("ignores a press of any button but the primary", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    fireEvent.pointerDown(nodeEl("a"), { button: 2, pointerId: 1 });
    fireEvent.pointerUp(nodeEl("a"), { pointerId: 1 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores a pointer up it has no gesture for", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    fireEvent.pointerUp(nodeEl("a"), { pointerId: 1 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select when the gesture is cancelled", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    fireEvent.pointerDown(nodeEl("a"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerCancel(nodeEl("a"), { pointerId: 1 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("opens a node on a double click", () => {
    const onOpen = vi.fn();
    renderCanvas({ onOpen });
    fireEvent.doubleClick(nodeEl("b"));
    expect(onOpen).toHaveBeenCalledWith("b");
  });

  it("reports a double click on the background in world coordinates, on the grid", () => {
    const onCanvasDoubleClick = vi.fn();
    renderCanvas({ onCanvasDoubleClick });
    const { x, y } = view();
    fireEvent.doubleClick(canvas(), { clientX: x + 123, clientY: y + 77 });
    expect(onCanvasDoubleClick).toHaveBeenCalledWith({ x: 120, y: 80 });
  });

  it("does nothing on a double click of the background without a handler", () => {
    const onOpen = vi.fn();
    renderCanvas({ onOpen });
    fireEvent.doubleClick(canvas());
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ignores a double click on one of its own controls", () => {
    const onCanvasDoubleClick = vi.fn();
    renderCanvas({ onCanvasDoubleClick });
    fireEvent.doubleClick(screen.getByRole("button", { name: "Zoom in" }));
    expect(onCanvasDoubleClick).not.toHaveBeenCalled();
  });
});

describe("JourneyCanvas keyboard", () => {
  it("opens a focused node on Enter", () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    renderCanvas({ onOpen, onSelect });
    press(nodeEl("a"), { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith("a");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects a focused node on Space, and on Enter when it cannot be opened", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    press(nodeEl("a"), { key: " " });
    press(nodeEl("b"), { key: "Enter" });
    expect(onSelect.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("unselects the selected node on Space", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect, selectedId: "a" });
    press(nodeEl("a"), { key: " " });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clears the selection on Escape", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect, selectedId: "a" });
    press(canvas(), { key: "Escape" });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("zooms with the plus and minus keys and fits with zero", () => {
    renderCanvas();
    press(canvas(), { key: "+" });
    expect(zoomLabel()).toBe("120%");
    press(canvas(), { key: "-" });
    press(canvas(), { key: "-" });
    expect(zoomLabel()).toBe("83%");
    press(canvas(), { key: "0" });
    expect(zoomLabel()).toBe("100%");
    press(canvas(), { key: "=" });
    expect(zoomLabel()).toBe("120%");
  });

  it("leaves the zoom keys to a field inside the canvas", () => {
    renderCanvas({ aside: <input aria-label="Name" /> });
    const field = screen.getByLabelText("Name");
    press(field, { key: "+" });
    expect(zoomLabel()).toBe("100%");
  });
});

describe("JourneyCanvas toolbar", () => {
  it("zooms in and out around the middle and resets to 100 %", () => {
    renderCanvas();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(zoomLabel()).toBe("120%");
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(zoomLabel()).toBe("83%");
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    expect(zoomLabel()).toBe("100%");
  });

  it("fits the graph again after it was panned away", () => {
    renderCanvas();
    const fitted = view();
    fireEvent.wheel(canvas(), { deltaX: 30, deltaY: 50 });
    expect(view()).not.toEqual(fitted);
    fireEvent.click(screen.getByRole("button", { name: "Fit graph to view" }));
    expect(view()).toEqual(fitted);
  });

  it("expands over the whole screen and back", () => {
    renderCanvas();
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(screen.getByRole("button", { name: "Leave full screen" })).toBeInTheDocument();
    expect(document.body.querySelector(".fixed")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Leave full screen" }));
    expect(document.body.querySelector(".fixed")).toBeNull();
  });

  it("closes the expanded view with Escape from outside the canvas", () => {
    renderCanvas();
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Full screen" })).toBeInTheDocument();
  });

  it("leaves Escape to a dialog or field while expanded", () => {
    renderCanvas({ aside: <input aria-label="Name" /> });
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Leave full screen" })).toBeInTheDocument();
  });

  it("steps back out of the expanded view on Escape inside the canvas", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    press(canvas(), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Full screen" })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("JourneyCanvas pan and zoom", () => {
  it("pans with the wheel", () => {
    renderCanvas();
    const before = view();
    fireEvent.wheel(canvas(), { deltaX: 30, deltaY: 50 });
    expect(view()).toEqual({ ...before, x: before.x - 30, y: before.y - 50 });
  });

  it("scales a wheel that counts lines", () => {
    renderCanvas();
    const before = view();
    fireEvent.wheel(canvas(), { deltaX: 0, deltaY: 2, deltaMode: 1 });
    expect(view().y).toBe(before.y - 32);
  });

  it("zooms around the pointer on a pinch", () => {
    renderCanvas();
    fireEvent.wheel(canvas(), { ctrlKey: true, deltaY: -10, clientX: 500, clientY: 300 });
    expect(view().zoom).toBeGreaterThan(1.05);
    expect(view().zoom).toBeLessThanOrEqual(1.75);
  });

  it("pans by dragging the background", () => {
    renderCanvas();
    const before = view();
    fireEvent.pointerDown(canvas(), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 150, clientY: 130 });
    fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 150, clientY: 130 });
    expect(view()).toEqual({ ...before, x: before.x + 50, y: before.y + 30 });
  });

  it("does not pan for a movement under the threshold", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    const before = view();
    fireEvent.pointerDown(canvas(), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 102, clientY: 101 });
    fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 102, clientY: 101 });
    expect(view()).toEqual(before);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("ignores moves of another pointer", () => {
    renderCanvas();
    const before = view();
    fireEvent.pointerDown(canvas(), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas(), { pointerId: 2, clientX: 300, clientY: 300 });
    expect(view()).toEqual(before);
  });

  it("does not select after a pan", () => {
    const onSelect = vi.fn();
    renderCanvas({ onSelect });
    fireEvent.pointerDown(nodeEl("a"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("a"), { pointerId: 1, clientX: 160, clientY: 100 });
    fireEvent.pointerUp(nodeEl("a"), { pointerId: 1, clientX: 160, clientY: 100 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("starts nothing on one of its own controls", () => {
    renderCanvas();
    const before = view();
    const button = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 300, clientY: 300 });
    expect(view()).toEqual(before);
  });
});

describe("JourneyCanvas moving nodes", () => {
  it("moves a node by dragging it, onto the grid", () => {
    const onMove = vi.fn();
    renderCanvas({ canMove: true, onMove });
    fireEvent.pointerDown(nodeEl("b"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("b"), { pointerId: 1, clientX: 164, clientY: 143 });
    fireEvent.pointerUp(nodeEl("b"), { pointerId: 1, clientX: 164, clientY: 143 });
    expect(onMove).toHaveBeenCalledWith("b", { x: 60, y: 240 });
  });

  it("shows the move straight away, and says the node is being dragged", () => {
    renderCanvas({ canMove: true, onMove: vi.fn() });
    fireEvent.pointerDown(nodeEl("b"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("b"), { pointerId: 1, clientX: 200, clientY: 100 });
    expect(nodeEl("b").style.left).toBe("0px");
    expect(screen.getByTestId("card-b")).toHaveAttribute("data-dragging", "true");
    fireEvent.pointerUp(nodeEl("b"), { pointerId: 1, clientX: 200, clientY: 100 });
    expect(screen.getByTestId("card-b")).toHaveAttribute("data-dragging", "false");
  });

  it("measures a drag at the zoom the view is on", () => {
    const onMove = vi.fn();
    renderCanvas({ canMove: true, onMove });
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    const zoom = view().zoom;
    fireEvent.pointerDown(nodeEl("a"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("a"), { pointerId: 1, clientX: 100 + 100 * zoom, clientY: 100 });
    fireEvent.pointerUp(nodeEl("a"), { pointerId: 1, clientX: 100 + 100 * zoom, clientY: 100 });
    expect(onMove).toHaveBeenCalledWith("a", { x: 100, y: 0 });
  });

  it("leaves the node where it was when the drag is cancelled", () => {
    const onMove = vi.fn();
    renderCanvas({ canMove: true, onMove });
    fireEvent.pointerDown(nodeEl("b"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("b"), { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerCancel(nodeEl("b"), { pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
    expect(nodeEl("b").style.left).toBe("-100px");
  });

  it("selects a node that is clicked rather than dragged", () => {
    const onSelect = vi.fn();
    const onMove = vi.fn();
    renderCanvas({ canMove: true, onMove, onSelect });
    fireEvent.pointerDown(nodeEl("b"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(nodeEl("b"), { pointerId: 1, clientX: 100, clientY: 100 });
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("pans, not moves, when nodes cannot be moved", () => {
    const onMove = vi.fn();
    renderCanvas({ onMove });
    const before = view();
    fireEvent.pointerDown(nodeEl("b"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("b"), { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(nodeEl("b"), { pointerId: 1, clientX: 140, clientY: 100 });
    expect(onMove).not.toHaveBeenCalled();
    expect(view().x).toBe(before.x + 40);
  });

  it("draws a node that is being dragged above the others", () => {
    renderCanvas({ canMove: true, onMove: vi.fn(), onSelect: vi.fn(), selectedId: "c" });
    expect(nodeEl("a")).toHaveClass("z-10");
    expect(nodeEl("c")).toHaveClass("z-20");
    fireEvent.pointerDown(nodeEl("a"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("a"), { pointerId: 1, clientX: 140, clientY: 100 });
    expect(nodeEl("a")).toHaveClass("z-30");
  });
});

describe("JourneyCanvas connecting nodes", () => {
  const dropOn = (id: string | null) => {
    document.elementFromPoint = () => (id ? nodeEl(id) : document.body);
  };

  it("shows a port on each node only when edges can be drawn", () => {
    const { unmount } = renderCanvas();
    expect(portEl("a")).toBeNull();
    unmount();
    renderCanvas({ canConnect: true });
    expect(portEl("a")).not.toBeNull();
  });

  it("connects a port to the node it is dropped on", () => {
    const onConnect = vi.fn();
    renderCanvas({ canConnect: true, onConnect });
    fireEvent.pointerDown(portEl("a"), { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 400, clientY: 300 });
    dropOn("c");
    fireEvent.pointerUp(canvas(), { pointerId: 1, clientX: 400, clientY: 300 });
    expect(onConnect).toHaveBeenCalledWith("a", "c");
  });

  it("draws the edge it is making while the pointer is down, and stops when it lets go", () => {
    renderCanvas({ canConnect: true, onConnect: vi.fn() });
    expect(document.querySelectorAll("path[stroke-dasharray='4 6']")).toHaveLength(0);
    fireEvent.pointerDown(portEl("a"), { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    expect(document.querySelectorAll("path[stroke-dasharray='4 6']")).toHaveLength(1);
    dropOn(null);
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    expect(document.querySelectorAll("path[stroke-dasharray='4 6']")).toHaveLength(0);
  });

  it("connects nothing when dropped on the background or on its own node", () => {
    const onConnect = vi.fn();
    renderCanvas({ canConnect: true, onConnect });
    fireEvent.pointerDown(portEl("a"), { button: 0, pointerId: 1 });
    dropOn(null);
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    fireEvent.pointerDown(portEl("a"), { button: 0, pointerId: 1 });
    dropOn("a");
    fireEvent.pointerUp(canvas(), { pointerId: 1 });
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("connects nothing when the gesture is cancelled", () => {
    const onConnect = vi.fn();
    renderCanvas({ canConnect: true, onConnect });
    fireEvent.pointerDown(portEl("a"), { button: 0, pointerId: 1 });
    dropOn("c");
    fireEvent.pointerCancel(canvas(), { pointerId: 1 });
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("JourneyCanvas removing edges", () => {
  const pickEdge = () => {
    const hit = document.querySelector("path[data-canvas-control]")!;
    fireEvent.pointerDown(hit, { button: 0, pointerId: 1 });
  };

  it("offers no way to pick an edge when edges cannot be drawn", () => {
    renderCanvas();
    expect(document.querySelector("path[data-canvas-control]")).toBeNull();
  });

  it("picks an edge, clearing the node selection, and offers to remove it", () => {
    const onSelect = vi.fn();
    renderCanvas({ canConnect: true, onDisconnect: vi.fn(), onSelect, selectedId: "a" });
    pickEdge();
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(screen.getByRole("button", { name: "Remove connection" })).toBeInTheDocument();
  });

  it("removes the picked edge with the button", () => {
    const onDisconnect = vi.fn();
    renderCanvas({ canConnect: true, onDisconnect });
    pickEdge();
    fireEvent.click(screen.getByRole("button", { name: "Remove connection" }));
    expect(onDisconnect).toHaveBeenCalledWith("a", "b");
    expect(screen.queryByRole("button", { name: "Remove connection" })).toBeNull();
  });

  it("removes the picked edge with Delete and with Backspace", () => {
    const onDisconnect = vi.fn();
    renderCanvas({ canConnect: true, onDisconnect });
    pickEdge();
    press(canvas(), { key: "Delete" });
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    pickEdge();
    press(canvas(), { key: "Backspace" });
    expect(onDisconnect).toHaveBeenCalledTimes(2);
  });

  it("does nothing on Delete without a picked edge", () => {
    const onDisconnect = vi.fn();
    renderCanvas({ canConnect: true, onDisconnect });
    press(canvas(), { key: "Delete" });
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it("puts the edge back down on Escape before anything else", () => {
    const onSelect = vi.fn();
    renderCanvas({ canConnect: true, onDisconnect: vi.fn(), onSelect });
    pickEdge();
    onSelect.mockClear();
    press(canvas(), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Remove connection" })).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("drops the picked edge when the background is pressed", () => {
    renderCanvas({ canConnect: true, onDisconnect: vi.fn() });
    pickEdge();
    fireEvent.pointerDown(canvas(), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    expect(screen.queryByRole("button", { name: "Remove connection" })).toBeNull();
  });
});

describe("JourneyCanvas emphasis", () => {
  it("lights up a hovered node's run and dims the rest", () => {
    renderCanvas();
    fireEvent.pointerEnter(nodeEl("a"));
    expect(screen.getByTestId("card-a")).toHaveAttribute("data-emphasis", "focus");
    expect(screen.getByTestId("card-b")).toHaveAttribute("data-emphasis", "related");
    expect(screen.getByTestId("card-c")).toHaveAttribute("data-emphasis", "dimmed");
    expect(edgeEls()[0]).toHaveAttribute("opacity", "1");
    fireEvent.pointerLeave(nodeEl("a"));
    expect(screen.getByTestId("card-c")).toHaveAttribute("data-emphasis", "none");
  });

  it("lights up on focus and puts it out on blur", () => {
    renderCanvas();
    fireEvent.focus(nodeEl("b"));
    expect(screen.getByTestId("card-a")).toHaveAttribute("data-emphasis", "related");
    fireEvent.blur(nodeEl("b"));
    expect(screen.getByTestId("card-a")).toHaveAttribute("data-emphasis", "none");
  });

  it("keeps a hover that moved on to another node", () => {
    renderCanvas();
    fireEvent.pointerEnter(nodeEl("a"));
    fireEvent.pointerEnter(nodeEl("c"));
    fireEvent.pointerLeave(nodeEl("a"));
    expect(screen.getByTestId("card-c")).toHaveAttribute("data-emphasis", "focus");
  });

  it("lights the selected node's run when nothing is hovered, and fades the other edges", () => {
    renderCanvas({ nodes: QUARTET, positions: QUARTET_PLACES, selectedId: "c" });
    expect(screen.getByTestId("card-d")).toHaveAttribute("data-emphasis", "related");
    expect(screen.getByTestId("card-a")).toHaveAttribute("data-emphasis", "dimmed");
    const opacity = (id: string) =>
      edgeEls()
        .find((edge) => edge.dataset.edge === id)!
        .getAttribute("opacity");
    expect(opacity("c->d")).toBe("1");
    expect(opacity("a->b")).toBe("0.18");
  });

  it("does not light anything while a node is being dragged", () => {
    renderCanvas({ canMove: true, onMove: vi.fn(), selectedId: "a" });
    expect(screen.getByTestId("card-b")).toHaveAttribute("data-emphasis", "related");
    fireEvent.pointerDown(nodeEl("c"), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(nodeEl("c"), { pointerId: 1, clientX: 150, clientY: 100 });
    expect(screen.getByTestId("card-b")).toHaveAttribute("data-emphasis", "none");
  });

  it("spotlights one node and fades everything else, edges included", () => {
    renderCanvas({ spotlightId: "c" });
    expect(screen.getByTestId("card-c")).toHaveAttribute("data-emphasis", "focus");
    expect(screen.getByTestId("card-a")).toHaveAttribute("data-emphasis", "dimmed");
    expect(edgeEls()[0]).toHaveAttribute("opacity", "0.18");
  });

  it("thickens the edges of the lit run", () => {
    renderCanvas();
    const resting = Number(edgeEls()[0].getAttribute("stroke-width"));
    fireEvent.pointerEnter(nodeEl("a"));
    expect(Number(edgeEls()[0].getAttribute("stroke-width"))).toBeCloseTo(resting + 0.75, 5);
  });
});

describe("JourneyCanvas minimap", () => {
  it("has no overview for a small graph", () => {
    renderCanvas();
    expect(screen.queryByRole("img", { name: /Overview of the graph/ })).toBeNull();
  });

  it("shows one for a larger graph, with a rectangle per node and one for the view", () => {
    renderCanvas({ nodes: QUARTET, positions: QUARTET_PLACES });
    const map = screen.getByRole("img", { name: /Overview of the graph/ });
    expect(map.querySelectorAll("rect")).toHaveLength(5);
  });

  it("marks the selected node on it", () => {
    renderCanvas({ nodes: QUARTET, positions: QUARTET_PLACES, selectedId: "d" });
    const map = screen.getByRole("img", { name: /Overview of the graph/ });
    expect(map.querySelectorAll("rect.fill-app-brand")).toHaveLength(1);
  });

  it("moves the view to where it is clicked", () => {
    renderCanvas({ nodes: QUARTET, positions: QUARTET_PLACES });
    const map = screen.getByRole("img", { name: /Overview of the graph/ });
    const before = view();
    fireEvent.pointerDown(map, { clientX: 20, clientY: 20 });
    expect(view().x).not.toBe(before.x);
    expect(view().zoom).toBe(before.zoom);
  });
});

describe("JourneyCanvas camera", () => {
  function withCamera(over: Partial<Props> = {}) {
    const cameraRef = createRef<JourneyCameraHandle>();
    renderCanvas({ cameraRef, ...over });
    return cameraRef;
  }

  it("says where the middle of the canvas is in the world", () => {
    const camera = withCamera();
    const { x, y, zoom } = view();
    expect(camera.current!.viewCenter()).toEqual({ x: (500 - x) / zoom, y: (300 - y) / zoom });
  });

  it("zooms into a node until it fills the canvas", async () => {
    const camera = withCamera();
    await act(() => camera.current!.zoomIntoNode("b", 0));
    expect(view().zoom).toBeCloseTo(Math.min(1000 / 200, 600 / 80) * 0.92, 5);
    expect(camera.current!.viewCenter()).toEqual({ x: 0, y: 200 });
  });

  it("does nothing for a node it does not know", async () => {
    const camera = withCamera();
    const before = view();
    await act(() => camera.current!.zoomIntoNode("nope", 0));
    expect(view()).toEqual(before);
  });

  it("flies back out to the whole graph", async () => {
    const camera = withCamera();
    const fitted = view();
    await act(() => camera.current!.zoomIntoNode("b", 0));
    await act(() => camera.current!.flyToFit(0));
    expect(view()).toEqual(fitted);
  });

  it("pans a node that is off screen into view, and leaves one that is in view", async () => {
    const camera = withCamera();
    const fitted = view();
    await act(() => camera.current!.revealNode("a", 0));
    expect(view()).toEqual(fitted);
    fireEvent.wheel(canvas(), { deltaX: 600, deltaY: 0 });
    const away = view();
    await act(() => camera.current!.revealNode("a", 0));
    expect(view().x).toBeGreaterThan(away.x);
    expect(view().y).toBe(away.y);
    expect(view().zoom).toBe(away.zoom);
  });

  it("does nothing to reveal a node it does not know", async () => {
    const camera = withCamera();
    const before = view();
    await act(() => camera.current!.revealNode("nope", 0));
    expect(view()).toEqual(before);
  });

  it("flies over time and lands on the target", async () => {
    const camera = withCamera();
    const fitted = view();
    await act(() => camera.current!.zoomIntoNode("b", 0));
    let landed = false;
    act(() => {
      void camera.current!.flyToFit(60).then(() => {
        landed = true;
      });
    });
    await waitFor(() => expect(landed).toBe(true));
    expect(view().zoom).toBeCloseTo(fitted.zoom, 5);
  });

  it("stops a flight at once when the wheel is used, and still settles it", async () => {
    const camera = withCamera();
    await act(() => camera.current!.zoomIntoNode("b", 0));
    let landed = false;
    act(() => {
      void camera.current!.flyToFit(5000).then(() => {
        landed = true;
      });
    });
    fireEvent.wheel(canvas(), { deltaX: 1, deltaY: 0 });
    await waitFor(() => expect(landed).toBe(true));
  });

  it("starts zoomed into a node and flies out to the whole graph", async () => {
    renderCanvas({ enterFromId: "b" });
    await waitFor(() => expect(view().zoom).toBe(1));
  });

  it("fits again when the graph changes, but not when it is just re-rendered", () => {
    const { rerender, props } = renderCanvas();
    fireEvent.wheel(canvas(), { deltaX: 100, deltaY: 0 });
    const panned = view();
    rerender(<JourneyCanvas<Item> {...props} />);
    expect(view()).toEqual(panned);
    rerender(<JourneyCanvas<Item> {...props} fitKey="two" />);
    expect(view()).not.toEqual(panned);
  });

  it("opens on the focus node when the graph is too large to read at once", () => {
    const nodes = [item("a"), item("b")];
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 6000, y: 0 }],
    ]);
    renderCanvas({ nodes, positions, focusId: "b" });
    expect(view().zoom).toBe(0.8);
    expect(view().x).toBeCloseTo(500 - 6000 * 0.8, 5);
  });
});
