import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUploadSelection } from "../../../../../src/features/knowledge-base/hooks/useUploadSelection";

describe("useUploadSelection", () => {
  it("toggles ids on and off", () => {
    const { result } = renderHook(() => useUploadSelection("scope-1"));
    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("b"));
    act(() => result.current.toggle("a"));
    expect([...result.current.selectedIds]).toEqual(["b"]);
  });

  it("reads as empty as soon as the list's scope changes", () => {
    const { result, rerender } = renderHook(({ scope }) => useUploadSelection(scope), {
      initialProps: { scope: "page-1" },
    });
    act(() => result.current.toggle("a"));
    rerender({ scope: "page-2" });
    expect(result.current.selectedIds.size).toBe(0);
    // Going back does not resurrect the old ticks either.
    rerender({ scope: "page-1" });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("clears on demand and when select mode is left", () => {
    const { result } = renderHook(() => useUploadSelection("scope-1"));
    act(() => result.current.setSelectMode(true));
    act(() => result.current.toggle("a"));
    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);

    act(() => result.current.toggle("b"));
    act(() => result.current.setSelectMode(false));
    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });
});
