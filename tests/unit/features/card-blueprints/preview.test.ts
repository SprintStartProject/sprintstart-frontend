import { describe, it, expect } from "vitest";
import { previewBands } from "../../../../src/features/card-blueprints/preview";
import type { CardBlueprint } from "../../../../src/features/card-blueprints/types";

function blueprint(over: Partial<CardBlueprint> & { id: string }): CardBlueprint {
  return {
    title: over.id,
    description: "",
    items: [],
    stage: "NOW",
    roleIds: [],
    position: 0,
    afterId: null,
    ...over,
  };
}

describe("what a set of blueprints becomes on a board", () => {
  it("files each card under the stage its blueprint names", () => {
    const bands = previewBands([blueprint({ id: "a" }), blueprint({ id: "b", stage: "LATER" })]);

    expect(bands.map((band) => [band.stage, band.entries.length])).toEqual([
      ["NOW", 1],
      ["LATER", 1],
    ]);
  });

  it("draws no band for a stage nothing is in", () => {
    expect(previewBands([blueprint({ id: "a" })]).map((band) => band.stage)).toEqual(["NOW"]);
  });

  it("collects a run into one card with the rest behind it", () => {
    const bands = previewBands([
      blueprint({ id: "a" }),
      blueprint({ id: "b", afterId: "a" }),
      blueprint({ id: "c", afterId: "b" }),
    ]);

    // The hire sees one card, not three — the same rule `buildStacks` applies on the board.
    expect(bands[0].entries).toHaveLength(1);
    expect(bands[0].entries[0].behind.map((behind) => behind.id)).toEqual(["b", "c"]);
  });

  it("keeps a chain that crosses a stage as a link, not a pile", () => {
    const bands = previewBands([
      blueprint({ id: "a" }),
      blueprint({ id: "b", stage: "LATER", afterId: "a" }),
    ]);

    // A pile is drawn in one band, so a link across two cannot become one — and the hire will see
    // exactly this: a card that waits, and says what for.
    expect(bands[0].entries[0].behind).toEqual([]);
    expect(bands[1].entries[0].waitsOn?.id).toBe("a");
  });

  it("stops a run where it forks, because a fork is not a sequence", () => {
    const bands = previewBands([
      blueprint({ id: "a" }),
      blueprint({ id: "b", afterId: "a" }),
      blueprint({ id: "c", afterId: "a" }),
    ]);

    expect(bands[0].entries.map((entry) => entry.blueprint.id)).toEqual(["a", "b", "c"]);
    expect(bands[0].entries[0].behind).toEqual([]);
    expect(bands[0].entries[1].waitsOn?.id).toBe("a");
  });

  it("ignores a 'comes after' pointing at a blueprint that is gone", () => {
    const bands = previewBands([blueprint({ id: "a", afterId: "deleted" })]);

    expect(bands[0].entries[0].waitsOn).toBeNull();
  });
});
