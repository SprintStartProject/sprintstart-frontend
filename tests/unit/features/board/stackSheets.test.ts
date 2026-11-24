import { describe, expect, it } from "vitest";
import type { CardStack } from "../../../../src/features/board/layout/cardStacks";
import {
  FAN_ROOM,
  sheetsBehind,
  STACK_SHEETS,
} from "../../../../src/features/board/layout/stackSheets";

function stack(memberIds: string[], topId: string): CardStack {
  return {
    rootId: memberIds[0],
    memberIds,
    topId,
    remaining: memberIds.length,
    members: new Map(
      memberIds.map((id) => [id, { name: `Card ${id}`, kind: "CURRENT_TASK" as const }]),
    ),
  };
}

const ids = (sheets: ReturnType<typeof sheetsBehind>) => sheets.map((sheet) => sheet.id);

describe("the sheets behind a closed pile", () => {
  it("is empty for a card that is not a pile", () => {
    expect(sheetsBehind(undefined, false)).toEqual([]);
    expect(sheetsBehind(undefined, true)).toEqual([]);
  });

  it("names the cards after the one on top, nearest first", () => {
    const sheets = sheetsBehind(stack(["a", "b", "c"], "a"), false);

    expect(ids(sheets)).toEqual(["b", "c"]);
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Card b", "Card c"]);
  });

  it("draws no more sheets than there are strips for", () => {
    const sheets = sheetsBehind(stack(["a", "b", "c", "d", "e"], "a"), false);

    expect(sheets).toHaveLength(STACK_SHEETS.length);
    expect(ids(sheets)).toEqual(["b", "c"]);
  });

  it("leaves out the finished cards before the top one when it is not pinned", () => {
    const sheets = sheetsBehind(stack(["a", "b", "c", "d"], "c"), false);

    expect(ids(sheets)).toEqual(["d"]);
  });

  it("fills in with the cards before a pinned top one, after the ones that follow it", () => {
    expect(ids(sheetsBehind(stack(["a", "b", "c", "d"], "c"), true))).toEqual(["d", "a"]);
    expect(ids(sheetsBehind(stack(["a", "b", "c"], "c"), true))).toEqual(["a", "b"]);
  });

  it("shows nothing under the last card of an unpinned pile", () => {
    expect(sheetsBehind(stack(["a", "b"], "b"), false)).toEqual([]);
  });

  it("gives each sheet the glyph and ink of its card's kind", () => {
    const [sheet] = sheetsBehind(stack(["a", "b"], "a"), false);

    expect(sheet.Icon).toBeTypeOf("object");
    expect(sheet.accent.icon).toEqual(expect.any(String));
  });

  it("names a member the pile knows nothing about as the next card", () => {
    const pile = stack(["a", "b"], "a");
    const partial: CardStack = { ...pile, members: new Map() };

    const [sheet] = sheetsBehind(partial, false);

    expect(sheet.name).toBe("The next card");
  });

  it("claims room under the pile only for as many sheets as it shows", () => {
    expect(FAN_ROOM).toHaveLength(STACK_SHEETS.length + 1);
    expect(FAN_ROOM[0]).toBe("");
    expect(FAN_ROOM[1]).not.toBe("");
    expect(FAN_ROOM[2]).not.toBe(FAN_ROOM[1]);
  });
});
