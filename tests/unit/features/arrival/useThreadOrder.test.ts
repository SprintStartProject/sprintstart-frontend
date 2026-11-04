import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThreadOrder } from "../../../../src/features/arrival/components/thread/useThreadOrder";
import { rowId } from "../../../../src/features/arrival/components/thread/threadRules";
import type { ArrivalStep } from "../../../../src/features/arrival/types";

const step = (key: string): ArrivalStep => ({
  key,
  projectId: null,
  projectName: null,
  title: key,
  description: null,
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
});

const rowAt = (top: number) =>
  ({
    getBoundingClientRect: () => ({
      left: 0,
      right: 100,
      top,
      bottom: top + 40,
      width: 100,
      height: 40,
    }),
  }) as unknown as HTMLElement;

const keysOf = (steps: ArrivalStep[]) => steps.map((entry) => entry.key);

let now = 1000;

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(company = ["a", "b", "c"], project: string[] = []) {
  const onReorder = vi.fn();
  const props = {
    companySteps: company.map(step),
    projectSteps: project.map(step),
    onReorder,
  };
  const view = renderHook((input: typeof props) => useThreadOrder(input), {
    initialProps: props,
  });
  return { ...view, onReorder, props };
}

/** Rows 50px apart: a at 0, b at 50, c at 100. */
function measure(
  result: { current: ReturnType<typeof useThreadOrder> },
  scope: "company" | "project" = "company",
) {
  act(() => {
    result.current.registerRow(rowId(scope, "a"), rowAt(0));
    result.current.registerRow(rowId(scope, "b"), rowAt(50));
    result.current.registerRow(rowId(scope, "c"), rowAt(100));
  });
}

/** Moves a's measured box down onto row c. */
function dragAOverC(result: { current: ReturnType<typeof useThreadOrder> }) {
  act(() => result.current.registerRow(rowId("company", "a"), rowAt(95)));
}

describe("useThreadOrder", () => {
  it("starts in the server's order with nothing dragged", () => {
    const { result } = setup();

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["a", "b", "c"]);
    expect(result.current.draggingScope).toBeNull();
    expect(result.current.draggingRowId).toBeNull();
    expect(result.current.justDroppedRowId).toBeNull();
  });

  it("marks the row and the scope in hand", () => {
    const { result } = setup();

    act(() => result.current.startDrag("a", "company"));

    expect(result.current.draggingRowId).toBe("company:a");
    expect(result.current.draggingScope).toBe("company");
  });

  it("moves the dragged row over the one it sits on", () => {
    const { result } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["b", "c", "a"]);
  });

  it("does not move a row that is over nothing", () => {
    const { result } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    act(() => result.current.dragRow("a", "company"));

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["a", "b", "c"]);
  });

  it("ignores a drag for a row that was never measured", () => {
    const { result } = setup();

    act(() => result.current.startDrag("a", "company"));
    act(() => result.current.dragRow("a", "company"));

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["a", "b", "c"]);
  });

  it("waits out the cooldown between two swaps", () => {
    const { result } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));
    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["b", "c", "a"]);

    // a is now over row b's slot; one frame later is too soon, 200ms later is not.
    act(() => result.current.registerRow(rowId("company", "a"), rowAt(50)));
    now += 100;
    act(() => result.current.dragRow("a", "company"));
    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["b", "c", "a"]);

    now += 100;
    act(() => result.current.dragRow("a", "company"));
    expect(keysOf(result.current.effectiveCompanySteps)).not.toEqual(["b", "c", "a"]);
  });

  it("restarts the cooldown when a new drag begins", () => {
    const { result } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));
    act(() => result.current.endDrag("a", "company"));

    // No time has passed, but a new drag may swap straight away.
    act(() => result.current.startDrag("b", "company"));
    act(() => result.current.registerRow(rowId("company", "b"), rowAt(95)));
    act(() => result.current.dragRow("b", "company"));

    expect(keysOf(result.current.effectiveCompanySteps)).not.toEqual(["b", "c", "a"]);
  });

  it("writes the new order down on release and rings the row for a moment", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result, onReorder } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));
    act(() => result.current.endDrag("a", "company"));

    expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"], "company");
    expect(result.current.draggingRowId).toBeNull();
    expect(result.current.draggingScope).toBeNull();
    expect(result.current.justDroppedRowId).toBe("company:a");

    act(() => {
      vi.advanceTimersByTime(649);
    });
    expect(result.current.justDroppedRowId).toBe("company:a");
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.justDroppedRowId).toBeNull();
  });

  it("writes nothing down when the drag ended where it began", () => {
    const { result, onReorder } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    act(() => result.current.endDrag("a", "company"));

    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.justDroppedRowId).toBeNull();
  });

  it("restarts the ring when a second drop follows quickly", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));
    act(() => result.current.endDrag("a", "company"));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    act(() => result.current.startDrag("b", "company"));
    act(() => result.current.registerRow(rowId("company", "b"), rowAt(95)));
    act(() => result.current.dragRow("b", "company"));
    act(() => result.current.endDrag("b", "company"));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.justDroppedRowId).toBe("company:b");
  });

  it("clears the ring when the list goes away", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));
    act(() => result.current.endDrag("a", "company"));
    unmount();

    expect(clear).toHaveBeenCalled();
  });

  it("forgets a row that is no longer on screen", () => {
    const { result } = setup();
    measure(result);

    act(() => result.current.registerRow(rowId("company", "c"), null));
    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["a", "b", "c"]);
  });

  it("follows the server's order when it changes and nothing is dragged", async () => {
    const { result, rerender, onReorder } = setup();

    await act(async () => {
      await Promise.resolve();
      rerender({
        companySteps: ["c", "b", "a"].map(step),
        projectSteps: [],
        onReorder,
      });
    });

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["c", "b", "a"]);
  });

  it("keeps the dragged scope in the pointer's hands while a refetch lands", async () => {
    const { result, rerender, onReorder } = setup();
    measure(result);

    act(() => result.current.startDrag("a", "company"));
    dragAOverC(result);
    act(() => result.current.dragRow("a", "company"));

    await act(async () => {
      await Promise.resolve();
      rerender({
        companySteps: ["a", "b", "c"].map(step),
        projectSteps: [],
        onReorder,
      });
    });

    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["b", "c", "a"]);
  });

  it("still follows the server for the scope that is not dragged", async () => {
    const { result, rerender, onReorder } = setup(["a", "b", "c"], ["x", "y"]);
    measure(result);
    act(() => result.current.startDrag("a", "company"));

    await act(async () => {
      await Promise.resolve();
      rerender({
        companySteps: ["a", "b", "c"].map(step),
        projectSteps: ["y", "x"].map(step),
        onReorder,
      });
    });

    expect(keysOf(result.current.effectiveProjectSteps)).toEqual(["y", "x"]);
  });

  it("keeps the two sections' orders apart", () => {
    const { result, onReorder } = setup(["a", "b", "c"], ["a", "b", "c"]);
    measure(result, "project");

    act(() => result.current.startDrag("a", "project"));
    act(() => result.current.registerRow(rowId("project", "a"), rowAt(95)));
    act(() => result.current.dragRow("a", "project"));
    act(() => result.current.endDrag("a", "project"));

    expect(keysOf(result.current.effectiveProjectSteps)).toEqual(["b", "c", "a"]);
    expect(keysOf(result.current.effectiveCompanySteps)).toEqual(["a", "b", "c"]);
    expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"], "project");
  });
});
