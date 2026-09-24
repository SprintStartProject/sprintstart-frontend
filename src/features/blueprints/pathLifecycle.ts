import type { BlueprintPathOverview, BlueprintStatus } from "./types.ts";

/**
 * What is actually true of one blueprint, as opposed to what its newest version's status says.
 *
 * The list endpoint returns **the latest version of each blueprint**, so its `status` is the status
 * of that version and not of the blueprint. The moment somebody opens a draft of a published
 * blueprint, the latest version is a draft — and a page that sorted by that status moved the
 * blueprint out of "Published" and into "Drafts" while every hire on the project was still being
 * given it. The page said the opposite of what was happening.
 *
 * A blueprint has two independent facts, and they were being collapsed into one:
 *
 * - **What is in service**, which is what hires get. Unchanged by anybody editing anything.
 * - **What is being written**, which is a draft nobody has yet.
 *
 * A draft carries the version it will become, and the backend numbers it one above the published
 * one — so a draft at v4 says v3 is live, and a draft at v0 says nothing is. That is how both facts
 * are read off a single row without asking the server for the history.
 */
export type BlueprintLifecycle = {
  /** The version hires are being given, or null when none is. */
  inService: number | null;
  /** The version being written, or null when nobody is writing one. */
  draft: number | null;
  /** True once the blueprint has been taken out of service for good. */
  retired: boolean;
  /** The id to open for the thing somebody most likely wants — the draft if there is one. */
  openId: string;
};

export function lifecycleOf(latest: BlueprintPathOverview): BlueprintLifecycle {
  if (latest.status === "DRAFT") {
    return {
      // A draft numbered 0 was never published: there is nothing behind it.
      inService: latest.version > 0 ? latest.version - 1 : null,
      draft: latest.version,
      retired: false,
      openId: latest.id,
    };
  }

  return {
    inService: latest.status === "ACTIVE" ? latest.version : null,
    draft: null,
    retired: latest.status === "ARCHIVED",
    openId: latest.id,
  };
}

/**
 * The three states a blueprint can be in from the point of view of the people it is for.
 *
 * Not the three statuses. "Archived" is a status and also a real state — the blueprint is finished
 * with. "Draft" is a status and *not* a state: a draft of a live blueprint and a draft of one that
 * was never published are two completely different situations, and the old page filed them
 * together while filing the live blueprint they belong to somewhere else entirely.
 */
export type LifecycleGroupKey = "live" | "unpublished" | "retired";

export const LIFECYCLE_GROUPS: {
  key: LifecycleGroupKey;
  title: string;
  hint: string;
}[] = [
  {
    key: "live",
    title: "In service",
    hint: "What a new hire on this project is given today. A draft here changes nothing until it is published.",
  },
  {
    key: "unpublished",
    title: "Not in service yet",
    hint: "Written but never published, so no hire has ever been given one of these.",
  },
  {
    key: "retired",
    title: "Retired",
    hint: "Taken out of service. Hires who were given one keep their copy.",
  },
];

export function groupKeyFor(lifecycle: BlueprintLifecycle): LifecycleGroupKey {
  if (lifecycle.retired) return "retired";
  return lifecycle.inService !== null ? "live" : "unpublished";
}

/** One blueprint, as the page needs it: the row from the server plus what it actually means. */
export type BlueprintRow = {
  latest: BlueprintPathOverview;
  lifecycle: BlueprintLifecycle;
};

/**
 * The blueprints grouped and ordered for reading.
 *
 * Within a group, the ones with a draft come first: a draft is the only thing on this page that is
 * waiting on the person reading it. Everything else is settled, and settled things are reference.
 */
export function groupBlueprints(
  paths: readonly BlueprintPathOverview[],
): { key: LifecycleGroupKey; title: string; hint: string; rows: BlueprintRow[] }[] {
  const rows = paths.map((latest) => ({ latest, lifecycle: lifecycleOf(latest) }));

  return LIFECYCLE_GROUPS.map((group) => ({
    ...group,
    rows: rows
      .filter((row) => groupKeyFor(row.lifecycle) === group.key)
      .sort((left, right) => {
        const byDraft =
          Number(right.lifecycle.draft !== null) - Number(left.lifecycle.draft !== null);
        return byDraft !== 0 ? byDraft : left.latest.title.localeCompare(right.latest.title);
      }),
  })).filter((group) => group.rows.length > 0);
}

/** The word for one version's own status, where a version rather than a blueprint is being named. */
export function versionWord(status: BlueprintStatus): string {
  return status === "ACTIVE" ? "Published" : status === "DRAFT" ? "Draft" : "Archived";
}
