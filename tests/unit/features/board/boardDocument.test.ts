import { beforeEach, describe, expect, it } from "vitest";

import {
  applyBoardDocument,
  fromWire,
  isEmptyDocument,
  readBoardDocument,
  toWire,
  type BoardDocument,
} from "../../../../src/features/board/sync/boardDocument";

const BOARD = "b1";
const PROJECT = "p1";

const arranged: BoardDocument = {
  cards: {
    c1: { stage: "LATER", dependsOn: [{ id: "c2", source: "TEAM" }], markedDone: true },
  },
  groupStages: { g1: "NOW" },
  groups: [{ id: "g1", name: "Paperwork", cardIds: ["c1"], collapsed: false }],
  collapsedCardIds: ["c3"],
  pinnedCardIds: ["c1"],
  sizes: { c1: { width: "wide" } },
  origins: { c1: { url: "/knowledge-base?artifact=a1", label: "Deployment" } },
  marks: { c1: [{ text: "on Thursdays", color: "green" }] },
};

describe("the board's arrangement as one document", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips through the seven places it is stored", () => {
    applyBoardDocument(BOARD, PROJECT, arranged);

    expect(readBoardDocument(BOARD, PROJECT)).toEqual(arranged);
  });

  it("writes the empty parts too, rather than keeping what this browser had", () => {
    applyBoardDocument(BOARD, PROJECT, arranged);

    // Applying a document is "this is the arrangement" — skipping its empty halves would silently
    // keep the local state the document was fetched to replace.
    applyBoardDocument(BOARD, PROJECT, emptyDocument());

    expect(isEmptyDocument(readBoardDocument(BOARD, PROJECT))).toBe(true);
  });

  it("knows an arrangement from the absence of one", () => {
    expect(isEmptyDocument(emptyDocument())).toBe(true);
    expect(isEmptyDocument(arranged)).toBe(false);
    // An area somebody named and then emptied is still an arrangement.
    expect(
      isEmptyDocument({
        ...emptyDocument(),
        groups: [{ id: "g1", name: "Week two", cardIds: [], collapsed: false }],
      }),
    ).toBe(false);
  });

  describe("the two enums the two sides case differently", () => {
    it("sends widths and colours up in the server's spelling", () => {
      const wire = toWire(arranged);

      expect(wire.sizes.c1.width).toBe("WIDE");
      expect(wire.marks.c1[0].color).toBe("GREEN");
    });

    it("brings them back down in the client's", () => {
      expect(fromWire(toWire(arranged))).toEqual(arranged);
    });

    it("falls back rather than losing the entry that carries an unknown value", () => {
      const wire = toWire(arranged);
      const odd = {
        ...wire,
        sizes: { c1: { width: "ENORMOUS" as never } },
        marks: { c1: [{ text: "on Thursdays", color: "CHARTREUSE" as never }] },
      };

      expect(fromWire(odd).sizes.c1).toEqual({ width: "normal" });
      expect(fromWire(odd).marks.c1).toEqual([{ text: "on Thursdays", color: "yellow" }]);
    });

    it("reads a document with fields missing as empty, never as undefined", () => {
      // `applyBoardDocument` writes every field, so an undefined one would be written as such.
      expect(fromWire({})).toEqual(emptyDocument());
      expect(fromWire(null)).toEqual(emptyDocument());
    });
  });
});

function emptyDocument(): BoardDocument {
  return {
    cards: {},
    groupStages: {},
    groups: [],
    collapsedCardIds: [],
    pinnedCardIds: [],
    sizes: {},
    origins: {},
    marks: {},
  };
}
