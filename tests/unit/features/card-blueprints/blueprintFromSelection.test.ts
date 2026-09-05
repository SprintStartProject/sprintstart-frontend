import { describe, expect, it } from "vitest";

import { blueprintFromSelection } from "../../../../src/features/card-blueprints/generation/blueprintFromSelection";

describe("a blueprint drafted from something a PM highlighted", () => {
  it("takes its name from the first line, not from a summary of the rest", () => {
    const draft = blueprintFromSelection("Read the deploy runbook\n\nIt is on the wiki.", null);

    expect(draft.title).toBe("Read the deploy runbook");
  });

  it("says where it came from, in the one field addressed to the hire", () => {
    expect(blueprintFromSelection("Anything", "Deployment").description).toBe("From Deployment");
    expect(blueprintFromSelection("Anything", null).description).toBe("");
  });

  it("turns a highlighted list into the card's lines", () => {
    const draft = blueprintFromSelection(
      "Before your first deploy\n\n- read the runbook\n- get a reviewer\n- announce in #release",
      null,
    );

    expect(draft.items).toEqual(["read the runbook", "get a reviewer", "announce in #release"]);
  });

  it("leaves the lines empty when the selection is prose", () => {
    expect(blueprintFromSelection("Deploys are on Thursdays.", null).items).toEqual([]);
  });

  it("leaves the two things a selection cannot know for the person to decide", () => {
    // A blueprint applies to every hire its roles match. Guessing either of these would be the app
    // deciding something about people who are not here yet.
    const draft = blueprintFromSelection("Read the runbook", "Deployment");

    expect(draft.roleIds).toEqual([]);
    expect(draft.afterId).toBeNull();
  });
});
