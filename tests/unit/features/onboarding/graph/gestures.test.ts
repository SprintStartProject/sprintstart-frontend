import { afterEach, describe, expect, it } from "vitest";
import {
  belowDragThreshold,
  doubleClickOn,
  draggedPosition,
  gestureFor,
  keyCommand,
  nodeAtPoint,
  pannedViewport,
  releaseOutcome,
  type KeyFacts,
  type NodeGesture,
  type PanGesture,
} from "../../../../../src/features/onboarding/graph/gestures";

const pointer = { pointerId: 7, clientX: 30, clientY: 40 };
const view = { x: 10, y: 20, zoom: 2 };

function build(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("gestureFor", () => {
  const positions = new Map([["a", { x: 5, y: 6 }]]);
  const rules = { canConnect: true, canMove: true, positions, viewport: view };

  it("starts drawing an edge on a port when edges can be drawn", () => {
    const host = build('<div data-journey-node="a"><span data-port-for="a" id="t"></span></div>');
    const gesture = gestureFor(host.querySelector<HTMLElement>("#t")!, pointer, rules);
    expect(gesture).toEqual({ kind: "connect", pointerId: 7, sourceId: "a" });
  });

  it("takes a port for its node when edges cannot be drawn", () => {
    const host = build('<div data-journey-node="a"><span data-port-for="a" id="t"></span></div>');
    const gesture = gestureFor(host.querySelector<HTMLElement>("#t")!, pointer, {
      ...rules,
      canConnect: false,
    });
    expect(gesture.kind).toBe("node");
  });

  it("starts moving a node that can be moved", () => {
    const host = build('<div data-journey-node="a"><b id="t"></b></div>');
    const gesture = gestureFor(host.querySelector<HTMLElement>("#t")!, pointer, rules);
    expect(gesture).toEqual({
      kind: "node",
      pointerId: 7,
      startX: 30,
      startY: 40,
      nodeId: "a",
      origin: { x: 5, y: 6 },
      moved: false,
    });
  });

  it("pans, remembering the node it landed on, when nodes cannot be moved", () => {
    const host = build('<div data-journey-node="a"><b id="t"></b></div>');
    const gesture = gestureFor(host.querySelector<HTMLElement>("#t")!, pointer, {
      ...rules,
      canMove: false,
    });
    expect(gesture).toEqual({
      kind: "pan",
      pointerId: 7,
      startX: 30,
      startY: 40,
      origin: view,
      moved: false,
      nodeId: "a",
    });
  });

  it("pans for a node it has no position for", () => {
    const host = build('<div data-journey-node="ghost"><b id="t"></b></div>');
    const gesture = gestureFor(host.querySelector<HTMLElement>("#t")!, pointer, rules);
    expect(gesture).toMatchObject({ kind: "pan", nodeId: "ghost" });
  });

  it("pans on the bare background without a node", () => {
    const host = build('<i id="t"></i>');
    const gesture = gestureFor(host.querySelector<HTMLElement>("#t")!, pointer, rules);
    expect(gesture).toMatchObject({ kind: "pan", nodeId: null });
  });
});

describe("drag arithmetic", () => {
  it("tells a click from a drag at four pixels", () => {
    expect(belowDragThreshold(3, 0)).toBe(true);
    expect(belowDragThreshold(0, -3.9)).toBe(true);
    expect(belowDragThreshold(4, 0)).toBe(false);
    expect(belowDragThreshold(3, 3)).toBe(false);
  });

  it("pans by the pointer's travel in screen pixels", () => {
    const gesture = { kind: "pan", origin: view } as PanGesture;
    expect(pannedViewport(gesture, 5, -7)).toEqual({ x: 15, y: 13, zoom: 2 });
  });

  it("moves a node by the pointer's travel in world pixels", () => {
    const gesture = { kind: "node", origin: { x: 100, y: 50 } } as NodeGesture;
    expect(draggedPosition(gesture, 20, -10, 2)).toEqual({ x: 110, y: 45 });
  });
});

describe("releaseOutcome", () => {
  const node = (moved: boolean): NodeGesture => ({
    kind: "node",
    pointerId: 1,
    startX: 0,
    startY: 0,
    nodeId: "a",
    origin: { x: 0, y: 0 },
    moved,
  });
  const pan = (moved: boolean, nodeId: string | null): PanGesture => ({
    kind: "pan",
    pointerId: 1,
    startX: 0,
    startY: 0,
    origin: view,
    moved,
    nodeId,
  });
  const facts = { cancelled: false, selectedId: null, dragged: null };

  it("asks for nothing when the gesture was cancelled", () => {
    expect(
      releaseOutcome(node(true), { ...facts, cancelled: true, dragged: { x: 1, y: 1 } }),
    ).toEqual({ type: "none" });
    expect(releaseOutcome(node(false), { ...facts, cancelled: true })).toEqual({ type: "none" });
    expect(releaseOutcome(pan(false, "a"), { ...facts, cancelled: true })).toEqual({
      type: "none",
    });
  });

  it("moves a dragged node, onto the grid", () => {
    expect(releaseOutcome(node(true), { ...facts, dragged: { x: 14, y: 26 } })).toEqual({
      type: "move",
      id: "a",
      position: { x: 10, y: 30 },
    });
  });

  it("does nothing for a node that moved without a position to land on", () => {
    expect(releaseOutcome(node(true), facts)).toEqual({ type: "none" });
  });

  it("selects a clicked node, and unselects it when it was already selected", () => {
    expect(releaseOutcome(node(false), facts)).toEqual({ type: "select", id: "a" });
    expect(releaseOutcome(node(false), { ...facts, selectedId: "a" })).toEqual({
      type: "select",
      id: null,
    });
  });

  it("selects the node under a clicked background gesture, toggling like a node does", () => {
    expect(releaseOutcome(pan(false, "b"), facts)).toEqual({ type: "select", id: "b" });
    expect(releaseOutcome(pan(false, "b"), { ...facts, selectedId: "b" })).toEqual({
      type: "select",
      id: null,
    });
  });

  it("clears the selection on a click of the bare background", () => {
    expect(releaseOutcome(pan(false, null), { ...facts, selectedId: "b" })).toEqual({
      type: "select",
      id: null,
    });
  });

  it("does nothing after a pan that moved the view", () => {
    expect(releaseOutcome(pan(true, "b"), facts)).toEqual({ type: "none" });
  });
});

describe("nodeAtPoint", () => {
  it("finds the node under the point", () => {
    const host = build('<div data-journey-node="a"><b id="t"></b></div>');
    const inner = host.querySelector("#t")!;
    document.elementFromPoint = () => inner;
    expect(nodeAtPoint(1, 1)).toBe("a");
  });

  it("finds nothing over the bare page", () => {
    document.elementFromPoint = () => document.body;
    expect(nodeAtPoint(1, 1)).toBeUndefined();
  });
});

describe("doubleClickOn", () => {
  it("opens the node it landed on", () => {
    const host = build('<div data-journey-node="a"><b id="t"></b></div>');
    expect(doubleClickOn(host.querySelector<HTMLElement>("#t")!)).toEqual({
      type: "open",
      id: "a",
    });
  });

  it("means the canvas on bare background", () => {
    const host = build('<i id="t"></i>');
    expect(doubleClickOn(host.querySelector<HTMLElement>("#t")!)).toEqual({ type: "canvas" });
  });

  it("leaves a control laid over the canvas alone", () => {
    const host = build(
      '<div data-canvas-control><div data-journey-node="a"><b id="t"></b></div></div>',
    );
    expect(doubleClickOn(host.querySelector<HTMLElement>("#t")!)).toEqual({ type: "none" });
  });
});

describe("keyCommand", () => {
  const facts: KeyFacts = {
    key: "x",
    nodeId: undefined,
    canOpen: true,
    inField: false,
    edgeSelected: false,
    expanded: false,
  };
  const press = (over: Partial<KeyFacts>) => keyCommand({ ...facts, ...over });

  it("opens a node on Enter where there is an open", () => {
    expect(press({ key: "Enter", nodeId: "a" })).toBe("open-node");
  });

  it("selects on Enter where there is nothing to open, and always on Space", () => {
    expect(press({ key: "Enter", nodeId: "a", canOpen: false })).toBe("activate-node");
    expect(press({ key: " ", nodeId: "a" })).toBe("activate-node");
  });

  it("does not treat Enter as a node key away from a node", () => {
    expect(press({ key: "Enter" })).toBe("none");
  });

  it("backs out one step per Escape: edge, then expanded view, then node", () => {
    expect(press({ key: "Escape", edgeSelected: true, expanded: true })).toBe("back-out-of-edge");
    expect(press({ key: "Escape", expanded: true })).toBe("back-out-of-expanded");
    expect(press({ key: "Escape" })).toBe("back-out-of-node");
  });

  it("zooms and fits from the keyboard", () => {
    expect(press({ key: "+" })).toBe("zoom-in");
    expect(press({ key: "=" })).toBe("zoom-in");
    expect(press({ key: "-" })).toBe("zoom-out");
    expect(press({ key: "0" })).toBe("fit");
  });

  it("removes the picked edge on Delete or Backspace", () => {
    expect(press({ key: "Delete" })).toBe("remove-edge");
    expect(press({ key: "Backspace" })).toBe("remove-edge");
  });

  it("leaves the keys to a field that has focus, except Escape", () => {
    expect(press({ key: "Delete", inField: true })).toBe("none");
    expect(press({ key: "+", inField: true })).toBe("none");
    expect(press({ key: "Escape", inField: true })).toBe("back-out-of-node");
  });

  it("ignores any other key", () => {
    expect(press({ key: "a" })).toBe("none");
  });
});
