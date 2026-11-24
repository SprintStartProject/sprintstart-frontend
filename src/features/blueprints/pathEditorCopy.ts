import type { CreateKind, LifecycleAction } from "./pathEditorTypes.ts";

/**
 * What each one-way lifecycle action is called and what it costs, said before it happens.
 *
 * Archiving already asked; publishing, reverting and deleting a draft did not, although publishing
 * is the one action here that people outside the team see and a deleted draft cannot be brought
 * back.
 */
export const LIFECYCLE_COPY: Record<
  LifecycleAction,
  {
    title: (version: number) => string;
    description: string;
    confirm: string;
    busy: string;
    failure: string;
  }
> = {
  publish: {
    title: (version) => `Publish version ${version}?`,
    description:
      "Every new hire on this project is given this version from now on, and the version published today stops being handed out. Anybody already on a path keeps their copy.",
    confirm: "Publish",
    busy: "Publishing…",
    failure: "Blueprint could not be published.",
  },
  rollback: {
    title: (version) => `Revert to version ${version}?`,
    description:
      "This version becomes the published blueprint again, and new hires are given it from now on. Anybody already on a path keeps their copy.",
    confirm: "Revert",
    busy: "Reverting…",
    failure: "Blueprint version could not be restored.",
  },
  "delete-draft": {
    title: (version) => `Delete draft version ${version}?`,
    description:
      "The draft and everything authored in it are gone for good — there is no undo. Published and archived versions are untouched.",
    confirm: "Delete draft",
    busy: "Deleting…",
    failure: "Blueprint draft could not be deleted.",
  },
};

/** What else goes when one of these is deleted — the part somebody has to weigh before saying yes. */
export const DELETE_CONSEQUENCE: Record<CreateKind, string> = {
  phase: "Its steps, knowledge checks and every prerequisite pointing at it go with it.",
  step: "Its tasks, resources and every prerequisite pointing at it go with it.",
  question: "Its answer options and every prerequisite pointing at it go with it.",
  task: "The line disappears from this step's checklist.",
  resource: "The link disappears from this step.",
  option: "The answer disappears from this question.",
};

export const kindLabels: Record<CreateKind, string> = {
  phase: "phase",
  step: "step",
  task: "task",
  resource: "resource",
  question: "question",
  option: "option",
};
