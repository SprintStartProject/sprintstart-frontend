import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardGrid } from "../../../../src/features/board/components/BoardGrid";
import type { BoardGroup } from "../../../../src/features/board/layout/boardGroups";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";
import type { Board, CurrentTaskContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

/**
 * Framer reports a drag as `(event, info)`, which jsdom has no pointer to produce. The shared mock
 * hands the handlers straight to the DOM, where `info` never arrives, so this one keeps each motion
 * element's latest props where a test can call them with a point of its own.
 */
const motionProps = vi.hoisted(() => new Map<Element, Record<string, unknown>>());

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const React = await import("react");
  const MOTION_ONLY = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "layout",
    "layoutId",
    "drag",
    "dragListener",
    "dragControls",
    "dragSnapToOrigin",
    "dragElastic",
    "dragMomentum",
    "onDragStart",
    "onDrag",
    "onDragEnd",
  ]);
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const motion = new Proxy(
    {},
    {
      get: (_target, tag) => {
        if (typeof tag !== "string") return undefined;
        const cached = cache.get(tag);
        if (cached) return cached;
        const Component = ({
          children,
          ref,
          ...props
        }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const dom = Object.fromEntries(
            Object.entries(props).filter(([k]) => !MOTION_ONLY.has(k)),
          );

          return React.createElement(
            tag,
            {
              ...dom,
              ref: (node: Element | null) => {
                if (node) motionProps.set(node, props);
                if (typeof ref === "function") (ref as (n: Element | null) => void)(node);
              },
            },
            children,
          );
        };
        cache.set(tag, Component as never);

        return Component;
      },
    },
  );

  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion,
  };
});

const task = (taskId: string): CurrentTaskContent => ({
  kind: "CURRENT_TASK",
  taskId,
  title: `Task ${taskId}`,
  summary: `About ${taskId}.`,
  url: null,
  closedAtSource: false,
});

function board(count: number): Board {
  return {
    boardId: "b1",
    projectId: "p1",
    cards: Array.from({ length: count }, (_, index) => ({
      id: `c${index}`,
      kind: "CURRENT_TASK" as const,
      owner: "AI" as const,
      position: index,
      placedAt: null,
      content: task(`t${index}`),
    })),
  };
}

type Rect = { left: number; top: number; width: number; height: number };

/** A 100 x 100 card per column, so "the middle" and "the edge" are plain coordinates. */
const RECTS: Rect[] = [
  { left: 0, top: 0, width: 100, height: 100 },
  { left: 200, top: 0, width: 100, height: 100 },
  { left: 400, top: 0, width: 100, height: 100 },
];

function place(element: Element, rect: Rect) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  });
}

/** The draggable card elements in the order the board draws them, given a place each. */
function cardElements(): Element[] {
  const cards = [...motionProps.entries()]
    .filter(([node, props]) => props.drag === true && node.tagName === "DIV" && node.isConnected)
    .map(([node]) => node);
  cards.forEach((node, index) => place(node, RECTS[index]));

  return cards;
}

type Handlers = {
  onDragStart: () => void;
  onDrag: (event: unknown, info: { point: { x: number; y: number } }) => void;
  onDragEnd: (event: unknown, info: { point: { x: number; y: number } }) => void;
};

function dragging(node: Element) {
  // Read at call time: the handlers are rebuilt as the drag changes what the grid holds.
  const props = new Proxy({} as Handlers, {
    get: (_target, key) => (motionProps.get(node) as unknown as Handlers)[key as keyof Handlers],
  });
  const at = (x: number, y: number) => ({ point: { x, y } });

  return {
    start: () => act(() => props.onDragStart()),
    over: (x: number, y: number) => act(() => props.onDrag({}, at(x, y))),
    letGo: (x: number, y: number) => act(() => props.onDragEnd({}, at(x, y))),
  };
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// The middle of the second card is (250, 50); its edge band is anywhere else inside it.
const MIDDLE = [250, 50] as const;
const EDGE = [205, 50] as const;

describe("dragging a card over another", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    motionProps.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup(extra: Partial<React.ComponentProps<typeof BoardGrid>> = {}) {
    const onReorder = vi.fn();
    const onStackOnto = vi.fn();
    const onAssignGroup = vi.fn();
    render(
      <BoardGrid
        board={board(3)}
        isArranging
        onReorder={onReorder}
        onStackOnto={onStackOnto}
        onAssignGroup={onAssignGroup}
        {...extra}
      />,
    );
    const [first, second] = cardElements();
    // The reorder cooldown reads the clock, which a fresh fake one starts at zero.
    vi.advanceTimersByTime(1000);

    return { onReorder, onStackOnto, onAssignGroup, drag: dragging(first), second };
  }

  it("swaps the two after resting on the other's edge for a beat", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(...EDGE);
    await wait(149);
    expect(onReorder).not.toHaveBeenCalled();

    await wait(1);
    expect(onReorder).toHaveBeenCalledWith(["c1", "c0", "c2"]);
  });

  it("does not swap while the pointer is still travelling across the edge", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(203, 50);
    await wait(100);
    drag.over(212, 50);
    await wait(100);
    drag.over(221, 50);
    await wait(100);

    expect(onReorder).not.toHaveBeenCalled();

    await wait(60);
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it("waits for a still hand on the edge: drift under the limit keeps the same wait running", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(205, 50);
    await wait(100);
    drag.over(210, 50);
    await wait(50);

    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it("lights the card underneath after resting on its middle, and says what letting go does", async () => {
    const { drag } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(349);
    expect(screen.queryByText("Drop to pile here")).not.toBeInTheDocument();

    await wait(1);
    expect(screen.getByText("Drop to pile here")).toBeInTheDocument();
  });

  it("does not swap the cards while the middle is lit", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(1000);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("keeps the middle lit while the hand stays inside it, even if it wanders a little", async () => {
    const { drag } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);
    drag.over(MIDDLE[0] + 5, MIDDLE[1] + 5);
    await wait(10);

    expect(screen.getByText("Drop to pile here")).toBeInTheDocument();
  });

  it("holds the middle slightly further out than it takes to get in", async () => {
    const { drag } = setup();

    // 35px from the centre of a 100px card: outside the way in (25), inside the way to stay (40).
    drag.start();
    drag.over(...MIDDLE);
    await wait(350);
    drag.over(285, 50);
    await wait(10);
    expect(screen.getByText("Drop to pile here")).toBeInTheDocument();

    // 45px out is past even that: it is the edge now, and the pile is put away.
    drag.over(295, 50);
    expect(screen.queryByText("Drop to pile here")).not.toBeInTheDocument();
  });

  it("puts the lit pile away when the pointer leaves the card", async () => {
    const { drag } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);
    drag.over(150, 50);

    expect(screen.queryByText("Drop to pile here")).not.toBeInTheDocument();
  });

  it("never lights anything when the board cannot pile", async () => {
    const { drag } = setup({ onStackOnto: undefined });

    drag.start();
    drag.over(...MIDDLE);
    await wait(1000);

    expect(screen.queryByText("Drop to pile here")).not.toBeInTheDocument();
  });

  it("piles the dragged card onto the lit one when let go", async () => {
    const { drag, onStackOnto, onReorder } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);
    drag.letGo(...MIDDLE);

    expect(onStackOnto).toHaveBeenCalledWith("c0", "c1");
    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.queryByText("Drop to pile here")).not.toBeInTheDocument();
  });

  it("does not pile when let go before the card was lit", async () => {
    const { drag, onStackOnto } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(100);
    drag.letGo(...MIDDLE);
    await wait(1000);

    expect(onStackOnto).not.toHaveBeenCalled();
    expect(screen.queryByText("Drop to pile here")).not.toBeInTheDocument();
  });

  it("carries a whole closed pile onto the lit card", async () => {
    const pile: CardStack = {
      rootId: "c0",
      memberIds: ["c0", "c2"],
      topId: "c0",
      remaining: 2,
      members: new Map(),
    };
    const { drag, onStackOnto } = setup({
      stacks: new Map([
        ["c0", pile],
        ["c2", pile],
      ]),
      expandedStackIds: new Set(),
    });

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);
    drag.letGo(...MIDDLE);

    expect(onStackOnto).toHaveBeenCalledWith("c0", "c1", ["c0", "c2"]);
  });

  it("moves only the picked-up card out of an open pile", async () => {
    const pile: CardStack = {
      rootId: "c0",
      memberIds: ["c0", "c2"],
      topId: "c0",
      remaining: 2,
      members: new Map(),
    };
    const { drag, onStackOnto } = setup({
      stacks: new Map([
        ["c0", pile],
        ["c2", pile],
      ]),
      expandedStackIds: new Set(["c0"]),
    });

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);
    drag.letGo(...MIDDLE);

    // An open pile's members sit together, so the second slot holds c2; no members are carried.
    expect(onStackOnto).toHaveBeenCalledWith("c0", "c2");
  });

  it("does not pile a card onto itself", async () => {
    const { drag, onStackOnto } = setup();

    drag.start();
    drag.over(50, 50);
    await wait(1000);
    drag.letGo(50, 50);

    expect(onStackOnto).not.toHaveBeenCalled();
  });

  it("cancels a pending swap when the pointer moves off every card", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(...EDGE);
    await wait(100);
    drag.over(350, 50);
    await wait(500);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("starts the wait over when the hand moves to a different card", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(...EDGE);
    await wait(100);
    drag.over(405, 50);
    await wait(100);
    expect(onReorder).not.toHaveBeenCalled();

    await wait(50);
    expect(onReorder).toHaveBeenCalledWith(["c1", "c2", "c0"]);
  });

  it("will not swap again until the last move has had time to land", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(...EDGE);
    await wait(150);
    expect(onReorder).toHaveBeenCalledTimes(1);

    drag.over(405, 50);
    await wait(150);
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it("forgets what it was resting on when a new drag starts", async () => {
    const { drag, onReorder } = setup();

    drag.start();
    drag.over(...EDGE);
    await wait(150);
    expect(onReorder).toHaveBeenCalledTimes(1);

    await wait(500);
    drag.start();
    drag.over(...EDGE);
    await wait(150);

    expect(onReorder).toHaveBeenCalledTimes(2);
  });

  it("labels a pile that would move the card into an area, and one that would take it out", async () => {
    const area: BoardGroup = { id: "g1", name: "Setup", cardIds: ["c1"], collapsed: false };
    const { drag } = setup({ groups: [area] });

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);

    expect(screen.getByText("Drop to pile here, in this area")).toBeInTheDocument();
  });

  it("labels a pile that would take the card out of its area", async () => {
    const area: BoardGroup = { id: "g1", name: "Setup", cardIds: ["c0"], collapsed: false };
    const { drag } = setup({ groups: [area] });

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);

    expect(screen.getByText("Drop to pile here, out of its area")).toBeInTheDocument();
  });
});

describe("letting go of a card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    motionProps.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** The area's box, placed over the second card's column so a drop point can be in or out of it. */
  function placeAreas() {
    [...motionProps.entries()]
      .filter(([node]) => node.tagName === "SECTION" && node.isConnected)
      .forEach(([node]) => place(node, { left: 190, top: -10, width: 130, height: 120 }));
  }

  function setup(
    groups: BoardGroup[],
    extra: Partial<React.ComponentProps<typeof BoardGrid>> = {},
  ) {
    const onAssignGroup = vi.fn();
    const onStackOnto = vi.fn();
    render(
      <BoardGrid
        board={board(3)}
        isArranging
        onReorder={vi.fn()}
        onAssignGroup={onAssignGroup}
        onStackOnto={onStackOnto}
        groups={groups}
        {...extra}
      />,
    );
    const [first] = cardElements();
    placeAreas();

    return { onAssignGroup, onStackOnto, drag: dragging(first) };
  }

  const area = (cardIds: string[]): BoardGroup => ({
    id: "g1",
    name: "Setup",
    cardIds,
    collapsed: false,
  });

  it("puts it in the area whose box the pointer is in", () => {
    const { drag, onAssignGroup } = setup([area(["c1"])]);

    drag.start();
    drag.letGo(195, 105);

    expect(onAssignGroup).toHaveBeenCalledWith("c0", "g1");
  });

  it("leaves it alone when it is let go in the area it is already in", () => {
    const { drag, onAssignGroup } = setup([area(["c0", "c1"])]);

    drag.start();
    drag.letGo(195, 105);

    expect(onAssignGroup).not.toHaveBeenCalled();
  });

  it("takes it out of its area when it is let go anywhere else", () => {
    const { drag, onAssignGroup } = setup([area(["c0", "c1"])]);

    drag.start();
    drag.letGo(700, 700);

    expect(onAssignGroup).toHaveBeenCalledWith("c0", null);
  });

  it("does nothing for a card that is in no area and lands outside every one", () => {
    const { drag, onAssignGroup } = setup([area(["c1"])]);

    drag.start();
    drag.letGo(700, 700);

    expect(onAssignGroup).not.toHaveBeenCalled();
  });

  it("decides by where the pointer is, however far the page has scrolled", () => {
    const { drag, onAssignGroup } = setup([area(["c1"])]);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(500);

    drag.start();
    drag.letGo(195, 605);

    expect(onAssignGroup).toHaveBeenCalledWith("c0", "g1");
  });

  it("takes it out of an open pile when it is let go outside the pile", () => {
    const pile: CardStack = {
      rootId: "c0",
      memberIds: ["c0", "c2"],
      topId: "c0",
      remaining: 2,
      members: new Map(),
    };
    const { drag, onStackOnto } = setup([], {
      stacks: new Map([
        ["c0", pile],
        ["c2", pile],
      ]),
      expandedStackIds: new Set(["c0"]),
    });
    const frame = document.querySelector('[data-stack-root="c0"]') as HTMLElement;
    place(frame, { left: 0, top: 0, width: 150, height: 300 });

    drag.start();
    drag.letGo(600, 600);

    expect(onStackOnto).toHaveBeenCalledWith("c0", null);
  });

  it("keeps it in an open pile when it is let go inside the pile", () => {
    const pile: CardStack = {
      rootId: "c0",
      memberIds: ["c0", "c2"],
      topId: "c0",
      remaining: 2,
      members: new Map(),
    };
    const { drag, onStackOnto } = setup([], {
      stacks: new Map([
        ["c0", pile],
        ["c2", pile],
      ]),
      expandedStackIds: new Set(["c0"]),
    });
    const frame = document.querySelector('[data-stack-root="c0"]') as HTMLElement;
    place(frame, { left: 0, top: 0, width: 150, height: 300 });

    drag.start();
    drag.letGo(75, 250);

    expect(onStackOnto).not.toHaveBeenCalled();
  });

  it("ignores areas on a board that cannot assign them", () => {
    const { drag, onAssignGroup } = setup([area(["c1"])], { onAssignGroup: undefined });

    drag.start();
    drag.letGo(195, 105);

    expect(onAssignGroup).not.toHaveBeenCalled();
  });
});

describe("what a drag looks like", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    motionProps.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup() {
    render(<BoardGrid board={board(3)} isArranging onReorder={vi.fn()} onStackOnto={vi.fn()} />);
    const cards = cardElements();

    return { cards, drag: dragging(cards[0]) };
  }

  it("lifts the dragged card and shows it grabbed, until it is let go", () => {
    const { cards, drag } = setup();
    expect(cards[0].className).not.toContain("z-40");

    drag.start();
    expect(cards[0].className).toContain("z-40");
    expect(cards[0].className).toContain("cursor-grabbing");
    expect(cards[1].className).not.toContain("z-40");

    drag.letGo(700, 700);
    expect(cards[0].className).not.toContain("z-40");
  });

  it("rings the card a drop would pile onto, and only that one", async () => {
    const { cards, drag } = setup();

    drag.start();
    drag.over(...MIDDLE);
    await wait(350);

    expect(cards[1].className).toContain("ring-2");
    expect(cards[0].className).not.toContain("ring-2");
    expect(cards[2].className).not.toContain("ring-2");
  });
});

describe("dragging an area", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    motionProps.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const area: BoardGroup = { id: "g1", name: "Setup", cardIds: ["c0"], collapsed: false };

  function setup() {
    const onReorder = vi.fn();
    render(<BoardGrid board={board(3)} groups={[area]} onReorder={onReorder} />);
    cardElements();
    const section = [...motionProps.entries()].find(
      ([node]) => node.tagName === "SECTION" && node.isConnected,
    );
    if (!section) throw new Error("no area drawn");
    vi.advanceTimersByTime(1000);

    return { onReorder, section: section[0], drag: (node: Element) => motionProps.get(node) };
  }

  /** Puts the area's box where its middle is over the second card. */
  const overSecondCard = (section: Element) =>
    place(section, { left: 210, top: 10, width: 80, height: 80 });

  it("lands on the block its middle is over", () => {
    const { onReorder, section, drag } = setup();
    overSecondCard(section);

    act(() => (drag(section)?.onDrag as () => void)());

    expect(onReorder).toHaveBeenCalledWith(["c1", "c0", "c2"]);
  });

  it("does nothing while its middle is over no card", () => {
    const { onReorder, section, drag } = setup();
    place(section, { left: 700, top: 700, width: 80, height: 80 });

    act(() => (drag(section)?.onDrag as () => void)());

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("does nothing while its middle is over its own cards", () => {
    const { onReorder, section, drag } = setup();
    place(section, { left: 10, top: 10, width: 80, height: 80 });

    act(() => (drag(section)?.onDrag as () => void)());

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("waits for the last move to land before moving again", () => {
    const { onReorder, section, drag } = setup();
    overSecondCard(section);

    act(() => (drag(section)?.onDrag as () => void)());
    act(() => (drag(section)?.onDrag as () => void)());
    expect(onReorder).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200);
    act(() => (drag(section)?.onDrag as () => void)());
    expect(onReorder).toHaveBeenCalledTimes(2);
  });
});

describe("moving a closed pile", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    motionProps.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const pile = (memberIds: string[]): CardStack => ({
    rootId: memberIds[0],
    memberIds,
    topId: memberIds[0],
    remaining: memberIds.length,
    members: new Map(),
  });

  function setup(memberIds: string[]) {
    const onReorder = vi.fn();
    const shared = pile(memberIds);
    render(
      <BoardGrid
        board={board(3)}
        boardOrder={["c0", "c1", "c2", "c3"]}
        stacks={new Map(memberIds.map((id) => [id, shared]))}
        expandedStackIds={new Set()}
        onReorder={onReorder}
      />,
    );
    const [first] = cardElements();
    vi.advanceTimersByTime(1000);

    return { onReorder, drag: dragging(first) };
  }

  it("takes the cards hidden behind it along when it is dragged over a neighbour", () => {
    const { onReorder, drag } = setup(["c0", "c3"]);

    drag.start();
    drag.over(...EDGE);
    act(() => void vi.advanceTimersByTime(150));

    expect(onReorder).toHaveBeenCalledWith(["c1", "c0", "c3", "c2"]);
  });

  it("is not moved onto a card that is part of it", () => {
    const { onReorder, drag } = setup(["c0", "c1"]);

    drag.start();
    drag.over(...EDGE);
    act(() => void vi.advanceTimersByTime(150));

    expect(onReorder).toHaveBeenCalledWith(["c0", "c1", "c2", "c3"]);
  });
});
