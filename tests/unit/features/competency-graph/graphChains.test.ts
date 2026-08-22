import { describe, expect, it } from "vitest";
import { chainFor, type GraphShape } from "../../../../src/features/competency-graph/layout";

function node(key: string): { key: string } {
  return { key };
}

function path(nodes: { key: string }[], edges: { from: string; to: string }[]): GraphShape {
  return { nodes, edges };
}

describe("chainFor", () => {
  it("includes everything the node reaches and everything reaching it", () => {
    const view = path(
      [node("a"), node("b"), node("c"), node("d")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    );

    // `d` is unrelated, so it must stay outside the chain -- that is what
    // makes the dimming mean something.
    expect(chainFor(view, "b")).toEqual(new Set(["a", "b", "c"]));
  });

  it("walks transitively in both directions, not just to direct neighbours", () => {
    const view = path(
      [node("root"), node("mid"), node("leaf")],
      [
        { from: "root", to: "mid" },
        { from: "mid", to: "leaf" },
      ],
    );

    expect(chainFor(view, "leaf")).toEqual(new Set(["root", "mid", "leaf"]));
  });

  it("terminates on a cycle instead of hanging the render", () => {
    const view = path(
      [node("a"), node("b")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    );

    expect(chainFor(view, "a")).toEqual(new Set(["a", "b"]));
  });

  it("returns just the node itself when it is connected to nothing", () => {
    const view = path([node("lonely"), node("other")], []);

    expect(chainFor(view, "lonely")).toEqual(new Set(["lonely"]));
  });
});
