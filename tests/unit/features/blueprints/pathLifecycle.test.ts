import { describe, expect, it } from "vitest";
import {
  groupBlueprints,
  lifecycleOf,
} from "../../../../src/features/blueprints/pathLifecycle.ts";
import type { BlueprintPathOverview } from "../../../../src/features/blueprints/types.ts";

function overview(over: Partial<BlueprintPathOverview> = {}): BlueprintPathOverview {
  return {
    id: "path-1",
    blueprintKey: "key-1",
    version: 1,
    revision: 0,
    title: "Backend onboarding",
    description: null,
    status: "ACTIVE",
    ...over,
  };
}

describe("lifecycleOf", () => {
  it("reads the published version out of the draft that sits on top of it", () => {
    // The backend numbers a draft one above the published version, which is the only way to know
    // what is live from a list that returns the newest version of each blueprint.
    expect(lifecycleOf(overview({ status: "DRAFT", version: 4 }))).toMatchObject({
      inService: 3,
      draft: 4,
      retired: false,
    });
  });

  it("says nothing is in service behind a draft that was never published", () => {
    expect(lifecycleOf(overview({ status: "DRAFT", version: 0 }))).toMatchObject({
      inService: null,
      draft: 0,
    });
  });

  it("has no draft pending for a published blueprint", () => {
    expect(lifecycleOf(overview({ status: "ACTIVE", version: 2 }))).toMatchObject({
      inService: 2,
      draft: null,
      retired: false,
    });
  });

  it("takes a retired blueprint out of service", () => {
    expect(lifecycleOf(overview({ status: "ARCHIVED", version: 5 }))).toMatchObject({
      inService: null,
      retired: true,
    });
  });

  it("opens the draft rather than the version behind it, when there is one", () => {
    expect(lifecycleOf(overview({ id: "draft-id", status: "DRAFT", version: 4 })).openId).toBe(
      "draft-id",
    );
  });
});

describe("groupBlueprints", () => {
  it("keeps a blueprint in service while a draft of it is open", () => {
    // The bug this page was rebuilt around: grouping by the newest version's status moved a live
    // blueprint out of "in service" the moment somebody started editing it.
    const [group] = groupBlueprints([overview({ status: "DRAFT", version: 4 })]);

    expect(group.key).toBe("live");
  });

  it("separates one nobody has ever been given from one that is live", () => {
    const groups = groupBlueprints([
      overview({ id: "new", status: "DRAFT", version: 0 }),
      overview({ id: "live", status: "ACTIVE", version: 1 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["live", "unpublished"]);
  });

  it("reads in a fixed order: what is live, what is not yet, what is finished with", () => {
    const groups = groupBlueprints([
      overview({ id: "old", status: "ARCHIVED" }),
      overview({ id: "new", status: "DRAFT", version: 0 }),
      overview({ id: "live", status: "ACTIVE" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["live", "unpublished", "retired"]);
  });

  it("puts the blueprints with something pending first inside a group", () => {
    const groups = groupBlueprints([
      overview({ id: "settled", title: "Alpha", status: "ACTIVE", version: 1 }),
      overview({ id: "pending", title: "Zulu", status: "DRAFT", version: 2 }),
    ]);

    expect(groups[0].rows.map((row) => row.latest.id)).toEqual(["pending", "settled"]);
  });

  it("falls back to the title, so the order does not wander between loads", () => {
    const groups = groupBlueprints([
      overview({ id: "b", title: "Beta" }),
      overview({ id: "a", title: "Alpha" }),
    ]);

    expect(groups[0].rows.map((row) => row.latest.title)).toEqual(["Alpha", "Beta"]);
  });

  it("leaves out a group with nothing in it", () => {
    expect(groupBlueprints([overview({ status: "ACTIVE" })])).toHaveLength(1);
  });
});
