import { describe, expect, it } from "vitest";
import type { BoardGroup } from "../../../../src/features/board/layout/boardGroups";
import type { BoardStage, CardState } from "../../../../src/features/board/layout/boardStructure";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";
import {
  buildBands,
  buildBlocks,
  emptyGroups,
  orderAfterBlockMove,
  spanningGroups,
  spanOf,
  stagesOf,
  type Block,
} from "../../../../src/features/board/layout/gridBlocks";
import type { BoardCard } from "../../../../src/features/board/types";

function card(id: string, kind: BoardCard["kind"] = "NOTE"): BoardCard {
  return {
    id,
    kind,
    owner: "AI",
    position: 0,
    placedAt: null,
    content: { kind, text: id } as BoardCard["content"],
  };
}

const cards = (...ids: string[]) => ids.map((id) => card(id));
const group = (id: string, cardIds: string[]): BoardGroup => ({
  id,
  name: id,
  cardIds,
  collapsed: false,
});

function stack(rootId: string, memberIds: string[]): CardStack {
  return { rootId, memberIds, topId: rootId, remaining: memberIds.length, members: new Map() };
}

function states(stages: Record<string, BoardStage>, done: string[] = []): Map<string, CardState> {
  return new Map(
    Object.entries(stages).map(([id, stage]) => [
      id,
      {
        status: done.includes(id) ? "DONE" : "OPEN",
        stage,
        blockedBy: [],
        predecessorId: null,
        predecessorSource: null,
        progress: null,
      },
    ]),
  );
}

const keys = (blocks: Block[]) => blocks.map((block) => block.key);

describe("buildBlocks", () => {
  it("makes one block of each loose card, in board order", () => {
    const blocks = buildBlocks(cards("a", "b", "c"), [], undefined, undefined);

    expect(keys(blocks)).toEqual(["card-a", "card-b", "card-c"]);
    expect(blocks.map((block) => block.kind)).toEqual(["card", "card", "card"]);
  });

  it("gathers an area's cards where its earliest member sat", () => {
    const blocks = buildBlocks(
      cards("a", "b", "c", "d"),
      [group("g", ["d", "b"])],
      undefined,
      undefined,
    );

    expect(keys(blocks)).toEqual(["card-a", "group-g", "card-c"]);
    expect(blocks[1].cards.map((c) => c.id)).toEqual(["b", "d"]);
  });

  it("keeps an area's members in board order whatever order they were added in", () => {
    const [area] = buildBlocks(
      cards("a", "b", "c"),
      [group("g", ["c", "a"])],
      undefined,
      undefined,
    );

    expect(area.cards.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("folds an open stack into one block", () => {
    const pile = stack("a", ["a", "c"]);
    const stacks = new Map([
      ["a", pile],
      ["c", pile],
    ]);

    const blocks = buildBlocks(cards("a", "b", "c"), [], stacks, new Set(["a"]));

    expect(keys(blocks)).toEqual(["stack-a", "card-b"]);
    expect(blocks[0].cards.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("leaves a closed stack as its separate cards", () => {
    const pile = stack("a", ["a", "c"]);
    const stacks = new Map([
      ["a", pile],
      ["c", pile],
    ]);

    const blocks = buildBlocks(cards("a", "b", "c"), [], stacks, new Set());

    expect(keys(blocks)).toEqual(["card-a", "card-b", "card-c"]);
  });

  it("folds an open stack inside an area into one item of that area", () => {
    const pile = stack("a", ["a", "b"]);
    const stacks = new Map([
      ["a", pile],
      ["b", pile],
    ]);

    const [area] = buildBlocks(
      cards("a", "b", "c"),
      [group("g", ["a", "b", "c"])],
      stacks,
      new Set(["a"]),
    );

    expect(area.kind).toBe("group");
    if (area.kind !== "group") return;
    expect(keys(area.items)).toEqual(["stack-a", "card-c"]);
  });

  it("does not repeat a card that is in an open stack and an area", () => {
    const pile = stack("a", ["a", "b"]);
    const stacks = new Map([
      ["a", pile],
      ["b", pile],
    ]);

    const blocks = buildBlocks(cards("a", "b"), [group("g", ["a", "b"])], stacks, new Set(["a"]));

    expect(keys(blocks)).toEqual(["group-g"]);
  });
});

describe("spanOf", () => {
  const block = (...ids: string[]): Block => ({
    kind: "card",
    key: ids[0],
    card: card(ids[0]),
    cards: cards(...ids),
  });

  it("is two columns for an ordinary card", () => {
    expect(spanOf(block("a"), 4, undefined)).toBe(2);
  });

  it("follows the width the hire pulled the card to", () => {
    expect(spanOf(block("a"), 4, { a: { width: "narrow" } })).toBe(1);
    expect(spanOf(block("a"), 4, { a: { width: "wide" } })).toBe(4);
  });

  it("never exceeds the columns the grid has", () => {
    expect(spanOf(block("a"), 1, { a: { width: "wide" } })).toBe(1);
    expect(spanOf(block("a"), 2, { a: { width: "wide" } })).toBe(2);
  });

  it("is as wide as the widest card in it", () => {
    expect(spanOf(block("a", "b"), 4, { a: { width: "narrow" }, b: { width: "wide" } })).toBe(4);
  });

  it("gives a diagram the full width whatever was chosen", () => {
    const diagram: Block = {
      kind: "card",
      key: "d",
      card: card("d", "DIAGRAM"),
      cards: [card("d", "DIAGRAM")],
    };

    expect(spanOf(diagram, 4, { d: { width: "narrow" } })).toBe(4);
  });

  it("never lets an area be narrower than two", () => {
    const area: Block = {
      kind: "group",
      key: "g",
      group: group("g", ["a"]),
      cards: cards("a"),
      items: [],
    };

    expect(spanOf(area, 4, { a: { width: "narrow" } })).toBe(2);
    expect(spanOf(area, 1, { a: { width: "narrow" } })).toBe(1);
  });
});

describe("stagesOf", () => {
  it("lists the stages the cards cover, earliest first", () => {
    const s = states({ a: "BEHIND", b: "NOW", c: "BEHIND" });

    expect(stagesOf(cards("a", "b", "c"), s)).toEqual(["NOW", "BEHIND"]);
  });

  it("files a card with no state under now", () => {
    expect(stagesOf(cards("a"), new Map())).toEqual(["NOW"]);
    expect(stagesOf(cards("a"), undefined)).toEqual(["NOW"]);
  });

  it("is empty for no cards", () => {
    expect(stagesOf([], states({}))).toEqual([]);
  });
});

describe("emptyGroups", () => {
  it("returns the areas none of the drawn cards belong to", () => {
    const groups = [group("full", ["a"]), group("empty", ["x"]), group("none", [])];

    expect(emptyGroups(cards("a", "b"), groups).map((g) => g.id)).toEqual(["empty", "none"]);
  });
});

describe("spanningGroups", () => {
  it("picks the areas whose cards sit in more than one stage", () => {
    const s = states({ a: "NOW", b: "BEHIND", c: "NOW", d: "NOW" });
    const blocks = buildBlocks(
      cards("a", "b", "c", "d"),
      [group("spread", ["a", "b"]), group("level", ["c", "d"])],
      undefined,
      undefined,
    );

    expect(keys(spanningGroups(blocks, s))).toEqual(["group-spread"]);
  });

  it("never picks a loose card", () => {
    const blocks = buildBlocks(cards("a"), [], undefined, undefined);

    expect(spanningGroups(blocks, states({ a: "NOW" }))).toEqual([]);
  });
});

describe("buildBands", () => {
  const blocksOf = (ids: string[]) => buildBlocks(cards(...ids), [], undefined, undefined);

  it("files each block under its stage, in stage order, with counts", () => {
    const s = states({ a: "BEHIND", b: "NOW", c: "NOW" }, ["c"]);

    const bands = buildBands(blocksOf(["a", "b", "c"]), [], s);

    expect(bands.map((band) => band.stage)).toEqual(["NOW", "BEHIND"]);
    expect(bands[0]).toMatchObject({ total: 2, remaining: 1 });
    expect(bands[1]).toMatchObject({ total: 1, remaining: 1 });
  });

  it("draws no bands when everything is in one", () => {
    const s = states({ a: "NOW", b: "NOW" });

    expect(buildBands(blocksOf(["a", "b"]), [], s)).toEqual([]);
  });

  it("still draws the band for finished work when it is the only one", () => {
    const s = states({ a: "BEHIND", b: "BEHIND" });

    const bands = buildBands(blocksOf(["a", "b"]), [], s);

    expect(bands.map((band) => band.stage)).toEqual(["BEHIND"]);
  });

  it("leaves the blocks it was told are spanning out of every band", () => {
    const s = states({ a: "NOW", b: "BEHIND", c: "BEHIND" });
    const blocks = blocksOf(["a", "b", "c"]);

    const bands = buildBands(blocks, [blocks[2]], s);

    expect(bands.flatMap((band) => keys(band.blocks))).toEqual(["card-a", "card-b"]);
  });

  it("files an area under the earliest stage any of its cards is in", () => {
    const s = states({ a: "BEHIND", b: "NOW", c: "BEHIND" });
    const blocks = buildBlocks(
      cards("a", "b", "c"),
      [group("g", ["a", "b"])],
      undefined,
      undefined,
    );

    const bands = buildBands(blocks, [], s);

    expect(bands.map((band) => [band.stage, keys(band.blocks)])).toEqual([
      ["NOW", ["group-g"]],
      ["BEHIND", ["card-c"]],
    ]);
  });
});

describe("orderAfterBlockMove", () => {
  const blocks = buildBlocks(
    cards("a", "b", "c", "d"),
    [group("g", ["a", "c"])],
    undefined,
    undefined,
  );
  // Blocks: group g (a, c), card b, card d.
  const ids = ["a", "b", "c", "d"];

  it("puts a block behind the far edge of the one it is stepped past, going down", () => {
    expect(orderAfterBlockMove(blocks, ids, 0, 1)).toEqual(["b", "a", "c", "d"]);
  });

  it("puts a block in front of the near edge of the one it is stepped past, going up", () => {
    expect(orderAfterBlockMove(blocks, ids, 2, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("keeps cards the view is hiding where they were", () => {
    expect(orderAfterBlockMove(blocks, ["a", "x", "b", "c", "d"], 0, 1)).toEqual([
      "x",
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("does nothing for a move onto itself", () => {
    expect(orderAfterBlockMove(blocks, ids, 1, 1)).toBeNull();
  });

  it("does nothing for a target off either end", () => {
    expect(orderAfterBlockMove(blocks, ids, 0, -1)).toBeNull();
    expect(orderAfterBlockMove(blocks, ids, 2, 3)).toBeNull();
  });

  it("does nothing when the moved block has no cards", () => {
    const empty: Block = { kind: "group", key: "g", group: group("g", []), cards: [], items: [] };

    expect(orderAfterBlockMove([empty, blocks[1]], ids, 0, 1)).toBeNull();
  });

  it("does nothing when the target's cards are not in the order", () => {
    expect(orderAfterBlockMove(blocks, ["a", "c", "d"], 0, 1)).toBeNull();
  });
});
