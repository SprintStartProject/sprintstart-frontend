import { describe, expect, it } from "vitest";
import {
  deriveDrawer,
  discardDescription,
  failureMessage,
  isSameDetails,
  memberBadgeLabel,
  moveDialogTitle,
  saveDecision,
  sourceBadgeLabel,
  unsavedChangesLabel,
} from "../../../../src/features/admin/components/projectDrawer/drawerRules";
import { createEmptyPeopleDraft } from "../../../../src/features/admin/peopleDraft";
import type { AdminProjectDetails, ProjectOverview } from "../../../../src/features/admin/types";

describe("isSameDetails", () => {
  it("compares name and description", () => {
    const base = { name: "Apollo", description: "Moon" };

    expect(isSameDetails(base, { ...base })).toBe(true);
    expect(isSameDetails(base, { ...base, name: "Gemini" })).toBe(false);
    expect(isSameDetails(base, { ...base, description: "Mars" })).toBe(false);
  });
});

describe("saveDecision", () => {
  it("refuses a blank name only when the details changed", () => {
    expect(saveDecision({ hasDetailsChanges: true, name: "   ", movedCount: 0 })).toBe(
      "name-required",
    );
    expect(saveDecision({ hasDetailsChanges: false, name: "   ", movedCount: 0 })).toBe("save");
  });

  it("asks before moving people out of other projects", () => {
    expect(saveDecision({ hasDetailsChanges: true, name: "Apollo", movedCount: 2 })).toBe(
      "confirm-move",
    );
  });

  it("saves otherwise", () => {
    expect(saveDecision({ hasDetailsChanges: true, name: "Apollo", movedCount: 0 })).toBe("save");
  });

  it("checks the name before the move", () => {
    expect(saveDecision({ hasDetailsChanges: true, name: "", movedCount: 3 })).toBe(
      "name-required",
    );
  });
});

describe("labels", () => {
  it("pluralises the unsaved changes", () => {
    expect(unsavedChangesLabel(1)).toBe("1 unsaved change");
    expect(unsavedChangesLabel(2)).toBe("2 unsaved changes");
  });

  it("names members and sources, or says there are none", () => {
    expect(memberBadgeLabel(0)).toBe("No members");
    expect(memberBadgeLabel(1)).toBe("1 member");
    expect(memberBadgeLabel(3)).toBe("3 members");
    expect(sourceBadgeLabel(0)).toBe("No sources");
    expect(sourceBadgeLabel(2)).toBe("2 sources");
  });

  it("titles the move dialog by how many people move", () => {
    expect(moveDialogTitle(1)).toBe("Move 1 person?");
    expect(moveDialogTitle(4)).toBe("Move 4 people?");
  });

  it("says how many changes leaving drops", () => {
    expect(discardDescription(1)).toBe("Leaving this project drops 1 unsaved change.");
    expect(discardDescription(3)).toBe("Leaving this project drops 3 unsaved changes.");
  });

  it("uses an error's own message and the fallback for anything else", () => {
    expect(failureMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(failureMessage("text", "fallback")).toBe("fallback");
  });
});

describe("deriveDrawer", () => {
  const project = {
    id: "p1",
    name: "Apollo",
    description: "Moon",
    manager: null,
    users: [],
    sources: [],
  } as unknown as ProjectOverview;

  const base = {
    project,
    projectDetails: null as AdminProjectDetails | null,
    draftProject: { name: "Apollo", description: "Moon" },
    peopleDraft: createEmptyPeopleDraft(""),
    availableUsers: [],
  };

  it("shows the overview until the details arrive, with no members", () => {
    const derived = deriveDrawer(base);

    expect(derived.visibleProject).toBe(project);
    expect(derived.visibleUsers).toEqual([]);
    expect(derived.hasDetailsChanges).toBe(false);
    expect(derived.pendingChangeCount).toBe(0);
    expect(derived.hasPendingChanges).toBe(false);
  });

  it("counts an edited name as one pending change", () => {
    const derived = deriveDrawer({
      ...base,
      draftProject: { name: "Gemini", description: "Moon" },
    });

    expect(derived.hasDetailsChanges).toBe(true);
    expect(derived.pendingChangeCount).toBe(1);
    expect(derived.hasPendingChanges).toBe(true);
  });

  it("prefers the loaded details over the overview", () => {
    const details = { ...project, name: "Apollo 2", users: [] } as unknown as AdminProjectDetails;
    const derived = deriveDrawer({ ...base, projectDetails: details });

    expect(derived.visibleProject).toBe(details);
    expect(derived.hasDetailsChanges).toBe(true);
  });
});
