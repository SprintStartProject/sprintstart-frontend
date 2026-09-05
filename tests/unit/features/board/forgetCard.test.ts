import { beforeEach, describe, expect, it } from "vitest";

import { forgetCard } from "../../../../src/features/board/layout/forgetCard";
import {
  applyBoardDocument,
  readBoardDocument,
} from "../../../../src/features/board/sync/boardDocument";

const BOARD = "b1";
const PROJECT = "p1";

describe("forgetting a card that is really gone", () => {
  beforeEach(() => {
    window.localStorage.clear();
    applyBoardDocument(BOARD, PROJECT, {
      cards: {
        c1: { stage: "LATER", dependsOn: [], markedDone: true },
        c2: { stage: "NOW", dependsOn: [{ id: "c1", source: "HIRE" }], markedDone: false },
      },
      groupStages: { g1: "NOW" },
      groups: [{ id: "g1", name: "Paperwork", cardIds: ["c1", "c2"], collapsed: false }],
      collapsedCardIds: ["c1"],
      pinnedCardIds: ["c1", "c2"],
      sizes: { c1: { width: "wide" }, c2: { width: "narrow" } },
      origins: {
        c1: { url: "/a", label: "A" },
        c2: { url: "/b", label: "B" },
      },
      marks: {
        c1: [{ text: "gone", color: "yellow" }],
        c2: [{ text: "stays", color: "blue" }],
      },
    });
  });

  it("takes it out of every layer", () => {
    forgetCard(BOARD, PROJECT, "c1");
    const document = readBoardDocument(BOARD, PROJECT);

    expect(document.cards.c1).toBeUndefined();
    expect(document.groups[0].cardIds).toEqual(["c2"]);
    expect(document.collapsedCardIds).toEqual([]);
    expect(document.pinnedCardIds).toEqual(["c2"]);
    expect(document.sizes.c1).toBeUndefined();
    expect(document.origins.c1).toBeUndefined();
    expect(document.marks.c1).toBeUndefined();
  });

  it("takes the edges that pointed at it with it", () => {
    // A card waiting on something dismissed waits forever. The derivation drops blockers it cannot
    // find, but a stored edge comes back the moment the id is reused.
    forgetCard(BOARD, PROJECT, "c1");

    expect(readBoardDocument(BOARD, PROJECT).cards.c2.dependsOn).toEqual([]);
  });

  it("leaves every other card exactly as it was", () => {
    const before = readBoardDocument(BOARD, PROJECT);
    forgetCard(BOARD, PROJECT, "c1");
    const after = readBoardDocument(BOARD, PROJECT);

    expect(after.cards.c2.stage).toBe(before.cards.c2.stage);
    expect(after.sizes.c2).toEqual(before.sizes.c2);
    expect(after.origins.c2).toEqual(before.origins.c2);
    expect(after.marks.c2).toEqual(before.marks.c2);
    expect(after.groupStages).toEqual(before.groupStages);
  });

  it("does nothing to a card it never knew", () => {
    const before = readBoardDocument(BOARD, PROJECT);
    forgetCard(BOARD, PROJECT, "c9");

    expect(readBoardDocument(BOARD, PROJECT)).toEqual(before);
  });
});
