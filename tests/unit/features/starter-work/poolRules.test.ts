import { describe, expect, it } from "vitest";
import {
  applyStatusFilter,
  closedLineFor,
  countStatuses,
  groupKeysOf,
  latestCheckedAt,
  mostRecentlyClosedFirst,
  onlyInProject,
  unseenFirst,
  visibleStatusFilters,
} from "../../../../src/features/starter-work/components/pool/poolRules";
import type { StarterWorkTask } from "../../../../src/services/starterWorkTypes";

function task(id: string, over: Partial<StarterWorkTask> = {}): StarterWorkTask {
  return {
    id,
    sourceId: `github:acme/repo:ISSUE:${id}`,
    title: `Task ${id}`,
    summary: null,
    rationale: null,
    sourceUrl: null,
    competencyKeys: [],
    status: "LIVE",
    reviewed: true,
    taskZeroEligible: false,
    sourceHasAssignee: null,
    sourceCheckedAt: null,
    ...over,
  };
}

const ids = (tasks: StarterWorkTask[]) => tasks.map((entry) => entry.id);

describe("closedLineFor", () => {
  it("is null without a timestamp", () => {
    expect(closedLineFor(task("1"))).toBeNull();
  });

  it("phrases the timestamp after 'Closed'", () => {
    const line = closedLineFor(task("1", { sourceCheckedAt: "2026-08-01T00:00:00.000Z" }));
    expect(line).toMatch(/^Closed .+/);
  });
});

describe("groupKeysOf", () => {
  it("collects the repo of each candidate once and ignores sources without a group", () => {
    const keys = groupKeysOf([
      { sourceId: "github:acme/repo:ISSUE:1" },
      { sourceId: "github:acme/repo:ISSUE:2" },
      { sourceId: "github:acme/other:ISSUE:3" },
      { sourceId: "manual" },
    ]);
    expect([...keys].sort()).toEqual(["acme/other", "acme/repo"]);
  });

  it("is empty before the candidates arrive", () => {
    expect(groupKeysOf(undefined).size).toBe(0);
  });
});

describe("unseenFirst", () => {
  it("moves unseen tasks to the front and keeps the rest in order", () => {
    const sorted = unseenFirst([
      task("a"),
      task("b", { reviewed: false }),
      task("c"),
      task("d", { reviewed: false }),
    ]);
    expect(ids(sorted)).toEqual(["b", "d", "a", "c"]);
  });

  it("does not change the list it is given", () => {
    const input = [task("a"), task("b", { reviewed: false })];
    unseenFirst(input);
    expect(ids(input)).toEqual(["a", "b"]);
  });
});

describe("mostRecentlyClosedFirst", () => {
  it("orders by timestamp, newest first, with undated tasks last", () => {
    const sorted = mostRecentlyClosedFirst([
      task("old", { sourceCheckedAt: "2026-01-01T00:00:00.000Z" }),
      task("none"),
      task("new", { sourceCheckedAt: "2026-06-01T00:00:00.000Z" }),
    ]);
    expect(ids(sorted)).toEqual(["new", "old", "none"]);
  });

  it("keeps an undated task behind a dated one whichever side it is compared from", () => {
    expect(
      ids(mostRecentlyClosedFirst([task("none"), task("d", { sourceCheckedAt: "2026-01-01" })])),
    ).toEqual(["d", "none"]);
    expect(
      ids(mostRecentlyClosedFirst([task("d", { sourceCheckedAt: "2026-01-01" }), task("none")])),
    ).toEqual(["d", "none"]);
  });
});

describe("latestCheckedAt", () => {
  it("is null when nothing was ever checked", () => {
    expect(latestCheckedAt([task("a"), task("b")])).toBeNull();
    expect(latestCheckedAt([])).toBeNull();
  });

  it("returns the newest timestamp wherever it sits", () => {
    const tasks = [
      task("a", { sourceCheckedAt: "2026-03-01T00:00:00.000Z" }),
      task("b", { sourceCheckedAt: "2026-05-01T00:00:00.000Z" }),
      task("c"),
      task("d", { sourceCheckedAt: "2026-04-01T00:00:00.000Z" }),
    ];
    expect(latestCheckedAt(tasks)).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("onlyInProject", () => {
  it("keeps tasks whose group is in the set and drops the others and ungrouped ones", () => {
    const tasks = [
      task("a"),
      task("b", { sourceId: "github:acme/other:ISSUE:2" }),
      task("c", { sourceId: "manual" }),
    ];
    expect(ids(onlyInProject(tasks, new Set(["acme/repo"])))).toEqual(["a"]);
  });
});

describe("countStatuses", () => {
  it("counts every tab from the live and closed lists", () => {
    const counts = countStatuses(
      [
        task("a"),
        task("b", { reviewed: false }),
        task("c", { taskZeroEligible: true }),
        task("d", { reviewed: false, taskZeroEligible: true }),
      ],
      [task("x"), task("y")],
    );
    expect(counts).toEqual({ all: 4, unseen: 2, seen: 2, taskZero: 2, closed: 2 });
  });
});

describe("visibleStatusFilters", () => {
  it("hides the closed tab until something closed", () => {
    expect(visibleStatusFilters(0, "all")).toEqual(["all", "unseen", "seen", "taskZero"]);
  });

  it("shows the closed tab last once something closed", () => {
    expect(visibleStatusFilters(2, "all")).toEqual(["all", "unseen", "seen", "taskZero", "closed"]);
  });

  it("keeps the closed tab while it is the active filter even when empty", () => {
    expect(visibleStatusFilters(0, "closed")).toContain("closed");
  });
});

describe("applyStatusFilter", () => {
  const tasks = [
    task("seen"),
    task("unseen", { reviewed: false }),
    task("zero", { taskZeroEligible: true }),
  ];

  it.each([
    ["all", ["seen", "unseen", "zero"]],
    ["unseen", ["unseen"]],
    ["seen", ["seen", "zero"]],
    ["taskZero", ["zero"]],
  ] as const)("%s", (filter, expected) => {
    expect(ids(applyStatusFilter(tasks, filter))).toEqual(expected);
  });
});
