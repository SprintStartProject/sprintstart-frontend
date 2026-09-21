import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useArtifactSelection } from "../../../../../src/features/knowledge-base/hooks/useArtifactSelection";

/** The element the drawer would own, appended to the document so containment means something. */
function container(): HTMLElement {
  const node = document.createElement("div");
  node.textContent = "the body of the artifact";
  document.body.append(node);

  return node;
}

/**
 * A selection of the given text, sitting inside `node`.
 *
 * jsdom has no real selection to make, so the parts the hook reads are the parts
 * that get faked — `commonAncestorContainer` is what decides whether the words
 * count as the artifact's.
 */
function stubSelection(text: string, node: Node | null) {
  const selection = {
    isCollapsed: text.length === 0,
    rangeCount: text.length === 0 ? 0 : 1,
    toString: () => text,
    getRangeAt: () => ({ commonAncestorContainer: node }),
    removeAllRanges: vi.fn(),
  };

  vi.spyOn(window, "getSelection").mockReturnValue(selection as unknown as Selection);

  return selection;
}

function read() {
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

describe("useArtifactSelection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("reports nothing while nothing is selected", () => {
    const node = container();
    stubSelection("", null);
    const { result } = renderHook(() => useArtifactSelection({ current: node }));

    read();

    expect(result.current.text).toBeNull();
  });

  it("reports the words selected inside the container", () => {
    const node = container();
    stubSelection("  the body of the artifact  ", node);
    const { result } = renderHook(() => useArtifactSelection({ current: node }));

    read();

    expect(result.current.text).toBe("the body of the artifact");
  });

  it("ignores a selection made outside the container", () => {
    const node = container();
    const elsewhere = document.createElement("p");
    document.body.append(elsewhere);
    stubSelection("somewhere else", elsewhere);
    const { result } = renderHook(() => useArtifactSelection({ current: node }));

    read();

    expect(result.current.text).toBeNull();
  });

  it("ignores a selection too short to be meant", () => {
    const node = container();
    stubSelection("a", node);
    const { result } = renderHook(() => useArtifactSelection({ current: node }));

    read();

    expect(result.current.text).toBeNull();
  });

  it("stops reporting once the selection collapses", () => {
    const node = container();
    const { result } = renderHook(() => useArtifactSelection({ current: node }));

    stubSelection("the body of the artifact", node);
    read();
    expect(result.current.text).toBe("the body of the artifact");

    stubSelection("", null);
    read();

    expect(result.current.text).toBeNull();
  });

  it("clears the selection when asked", () => {
    const node = container();
    const selection = stubSelection("the body of the artifact", node);
    const { result } = renderHook(() => useArtifactSelection({ current: node }));

    read();
    act(() => {
      result.current.clear();
    });

    expect(selection.removeAllRanges).toHaveBeenCalledTimes(1);
    expect(result.current.text).toBeNull();
  });
});
