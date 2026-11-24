import { describe, expect, it } from "vitest";
import {
  DELETE_CONSEQUENCE,
  LIFECYCLE_COPY,
  kindLabels,
} from "../../../../src/features/blueprints/pathEditorCopy.ts";

describe("pathEditorCopy", () => {
  it("names the version in each lifecycle question", () => {
    expect(LIFECYCLE_COPY.publish.title(4)).toBe("Publish version 4?");
    expect(LIFECYCLE_COPY.rollback.title(2)).toBe("Revert to version 2?");
    expect(LIFECYCLE_COPY["delete-draft"].title(7)).toBe("Delete draft version 7?");
  });

  it("says what each lifecycle action costs and reports its busy and failed states", () => {
    expect(LIFECYCLE_COPY.publish).toMatchObject({
      confirm: "Publish",
      busy: "Publishing…",
      failure: "Blueprint could not be published.",
    });
    expect(LIFECYCLE_COPY.rollback).toMatchObject({
      confirm: "Revert",
      busy: "Reverting…",
      failure: "Blueprint version could not be restored.",
    });
    expect(LIFECYCLE_COPY["delete-draft"]).toMatchObject({
      confirm: "Delete draft",
      busy: "Deleting…",
      failure: "Blueprint draft could not be deleted.",
    });
    expect(LIFECYCLE_COPY.publish.description).toContain("new hire");
    expect(LIFECYCLE_COPY.rollback.description).toContain("published blueprint again");
    expect(LIFECYCLE_COPY["delete-draft"].description).toContain("no undo");
  });

  it("says what goes with each kind of deleted item", () => {
    expect(DELETE_CONSEQUENCE.phase).toContain("prerequisite");
    expect(DELETE_CONSEQUENCE.step).toContain("tasks, resources");
    expect(DELETE_CONSEQUENCE.question).toContain("answer options");
    expect(DELETE_CONSEQUENCE.task).toContain("checklist");
    expect(DELETE_CONSEQUENCE.resource).toContain("link");
    expect(DELETE_CONSEQUENCE.option).toContain("answer");
  });

  it("labels each kind with its own name", () => {
    expect(kindLabels).toEqual({
      phase: "phase",
      step: "step",
      task: "task",
      resource: "resource",
      question: "question",
      option: "option",
    });
  });
});
