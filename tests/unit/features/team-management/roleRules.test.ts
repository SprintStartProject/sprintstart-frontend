import { describe, expect, it } from "vitest";
import {
  ROLE_SORT_OPTIONS,
  applyChanges,
  assignmentChanges,
  failedMemberNames,
  filterAndSortRoles,
  filterMembers,
  fullName,
  isListNarrowed,
  membersForAssignment,
  membersOfRole,
  mergeRoleSkills,
  nameList,
  skillsOfRole,
  suggestionsToApply,
  uniqueSuggestions,
  withoutRole,
} from "../../../../src/features/team-management/roleRules";
import type {
  ProjectRole,
  Skill,
  SkillSuggestion,
  TeamOverviewUser,
} from "../../../../src/services/teamManagementTypes";

const frontend: ProjectRole = { id: "r1", name: "Frontend", description: "Builds the UI" };
const backend: ProjectRole = { id: "r2", name: "Backend", description: "Owns the services" };
const design: ProjectRole = { id: "r3", name: "Design", description: "" };

function skill(id: string, name: string, roleIds: string[], status: Skill["status"] = "ACTIVE") {
  return { id, name, roleIds, status, category: null, universal: false } as Skill;
}

function user(userId: string, firstname: string, lastname: string, roles: ProjectRole[]) {
  return { userId, firstname, lastname, roles } as unknown as TeamOverviewUser;
}

function suggestion(name: string, skillId: string | null = null): SkillSuggestion {
  return {
    skillId,
    name,
    category: null,
    reason: "",
    confidence: "high",
    isNew: skillId === null,
    chunkIds: [],
  };
}

const react = skill("s1", "React", ["r1"]);
const sql = skill("s2", "SQL", ["r1", "r2"]);
const jquery = skill("s3", "jQuery", ["r1"], "RETIRED");
const angular = skill("s4", "Angular", ["r1"], "RETIRED");
const skills = [jquery, sql, react, angular];

const ada = user("u1", "Ada", "Lovelace", [frontend]);
const grace = user("u2", "Grace", "Hopper", []);
const linus = user("u3", "Linus", "Torvalds", [backend, frontend]);
const users = [grace, ada, linus];

describe("nameList", () => {
  it("lists up to three names", () => {
    expect(nameList(["A", "B", "C"])).toBe("A, B, C");
  });

  it("counts the rest", () => {
    expect(nameList(["A", "B", "C", "D", "E"])).toBe("A, B, C +2");
  });

  it("honours another limit", () => {
    expect(nameList(["A", "B", "C"], 2)).toBe("A, B +1");
    expect(nameList([], 2)).toBe("");
  });
});

describe("fullName", () => {
  it("joins first and last name", () => {
    expect(fullName(ada)).toBe("Ada Lovelace");
  });
});

describe("ROLE_SORT_OPTIONS", () => {
  it("offers name, members and skills", () => {
    expect(ROLE_SORT_OPTIONS).toEqual([
      { value: "name", label: "Name" },
      { value: "members", label: "Most members" },
      { value: "skills", label: "Most skills" },
    ]);
  });
});

describe("skillsOfRole", () => {
  it("keeps the role's skills, active first and each group alphabetical", () => {
    expect(skillsOfRole(skills, "r1").map((entry) => entry.name)).toEqual([
      "React",
      "SQL",
      "Angular",
      "jQuery",
    ]);
  });

  it("leaves out the skills of other roles", () => {
    expect(skillsOfRole(skills, "r2").map((entry) => entry.name)).toEqual(["SQL"]);
    expect(skillsOfRole(skills, "r3")).toEqual([]);
  });

  it("does not reorder the catalog it reads", () => {
    const before = skills.map((entry) => entry.id);
    skillsOfRole(skills, "r1");
    expect(skills.map((entry) => entry.id)).toEqual(before);
  });
});

describe("membersOfRole", () => {
  it("keeps whoever holds the role", () => {
    expect(membersOfRole(users, "r1").map((entry) => entry.userId)).toEqual(["u1", "u3"]);
    expect(membersOfRole(users, "r2").map((entry) => entry.userId)).toEqual(["u3"]);
    expect(membersOfRole(users, "r3")).toEqual([]);
  });
});

describe("mergeRoleSkills", () => {
  it("replaces the entries the answer carries", () => {
    const renamed = { ...react, name: "React 19" };
    const merged = mergeRoleSkills([react, sql], "r1", [renamed, sql]);
    expect(merged.map((entry) => entry.name)).toEqual(["React 19", "SQL"]);
  });

  it("unlinks the skills the role does not list any more", () => {
    const merged = mergeRoleSkills([react, sql], "r1", [react]);
    expect(merged.find((entry) => entry.id === "s2")?.roleIds).toEqual(["r2"]);
  });

  it("leaves skills of other roles untouched", () => {
    const other = skill("s9", "Go", ["r2"]);
    const merged = mergeRoleSkills([other], "r1", []);
    expect(merged[0]).toBe(other);
  });

  it("appends skills the catalog did not know", () => {
    const merged = mergeRoleSkills([react], "r1", [react, sql]);
    expect(merged.map((entry) => entry.id)).toEqual(["s1", "s2"]);
  });
});

describe("withoutRole", () => {
  it("removes the role from every skill", () => {
    const result = withoutRole([react, sql], "r1");
    expect(result.map((entry) => entry.roleIds)).toEqual([[], ["r2"]]);
  });
});

describe("isListNarrowed", () => {
  const plain = { query: "", gap: null, sort: "name" as const, openRoleId: null };

  it("is false for the default list", () => {
    expect(isListNarrowed(plain)).toBe(false);
  });

  it("ignores a blank search", () => {
    expect(isListNarrowed({ ...plain, query: "   " })).toBe(false);
  });

  it("is true for a search, a gap or another sort", () => {
    expect(isListNarrowed({ ...plain, query: "x" })).toBe(true);
    expect(isListNarrowed({ ...plain, gap: "no-skills" })).toBe(true);
    expect(isListNarrowed({ ...plain, sort: "members" })).toBe(true);
  });
});

describe("filterAndSortRoles", () => {
  const roles = [frontend, backend, design];
  const base = { query: "", gap: null, sort: "name" as const, openRoleId: null };
  const names = (list: ProjectRole[]) => list.map((entry) => entry.name);

  it("sorts by name by default", () => {
    expect(names(filterAndSortRoles(roles, skills, users, base))).toEqual([
      "Backend",
      "Design",
      "Frontend",
    ]);
  });

  it("does not reorder the roles it was given", () => {
    filterAndSortRoles(roles, skills, users, base);
    expect(names(roles)).toEqual(["Frontend", "Backend", "Design"]);
  });

  it("sorts by member count, then name", () => {
    expect(names(filterAndSortRoles(roles, skills, users, { ...base, sort: "members" }))).toEqual([
      "Frontend",
      "Backend",
      "Design",
    ]);
  });

  it("sorts by skill count, then name", () => {
    expect(names(filterAndSortRoles(roles, skills, users, { ...base, sort: "skills" }))).toEqual([
      "Frontend",
      "Backend",
      "Design",
    ]);
  });

  it("breaks a tie by name", () => {
    const tied = [skill("a", "A", ["r1"]), skill("b", "B", ["r2"])];
    expect(names(filterAndSortRoles(roles, tied, [], { ...base, sort: "skills" }))).toEqual([
      "Backend",
      "Frontend",
      "Design",
    ]);
  });

  it("narrows to roles nobody holds", () => {
    expect(names(filterAndSortRoles(roles, skills, users, { ...base, gap: "no-members" }))).toEqual(
      ["Design"],
    );
  });

  it("narrows to roles without skills", () => {
    expect(names(filterAndSortRoles(roles, skills, users, { ...base, gap: "no-skills" }))).toEqual([
      "Design",
    ]);
  });

  it("finds a role by name, description, skill or member", () => {
    const find = (query: string) =>
      names(filterAndSortRoles(roles, skills, users, { ...base, query }));
    expect(find("front")).toEqual(["Frontend"]);
    expect(find("services")).toEqual(["Backend"]);
    expect(find("angular")).toEqual(["Frontend"]);
    expect(find("torvalds")).toEqual(["Backend", "Frontend"]);
    expect(find("  REACT ")).toEqual(["Frontend"]);
    expect(find("nothing")).toEqual([]);
  });

  it("keeps the open role whatever the filters say", () => {
    const result = filterAndSortRoles(roles, skills, users, {
      query: "nothing",
      gap: "no-members",
      sort: "name",
      openRoleId: "r1",
    });
    expect(names(result)).toEqual(["Frontend"]);
  });
});

describe("membersForAssignment", () => {
  it("puts the holders first and keeps the rest in order", () => {
    const ordered = membersForAssignment(users, ["u3", "u1"]);
    expect(ordered.map((entry) => entry.userId)).toEqual(["u1", "u3", "u2"]);
  });

  it("does not reorder the users it was given", () => {
    membersForAssignment(users, ["u3"]);
    expect(users.map((entry) => entry.userId)).toEqual(["u2", "u1", "u3"]);
  });
});

describe("filterMembers", () => {
  const ordered = [ada, linus, grace];
  const ids = (list: TeamOverviewUser[]) => list.map((entry) => entry.userId);

  it("shows everyone when nothing is chosen", () => {
    expect(ids(filterMembers(ordered, ["u1"], "", null))).toEqual(["u1", "u3", "u2"]);
  });

  it("narrows to those who held the role", () => {
    expect(ids(filterMembers(ordered, ["u1"], "", "holds"))).toEqual(["u1"]);
  });

  it("narrows to those without any role", () => {
    expect(ids(filterMembers(ordered, ["u1"], "", "without"))).toEqual(["u2"]);
  });

  it("searches by full name, ignoring case and padding", () => {
    expect(ids(filterMembers(ordered, [], " LACE ", null))).toEqual(["u1"]);
    expect(ids(filterMembers(ordered, [], "ada lovelace", null))).toEqual(["u1"]);
    expect(ids(filterMembers(ordered, [], "zzz", null))).toEqual([]);
  });

  it("combines the filter and the search", () => {
    expect(ids(filterMembers(ordered, ["u1", "u3"], "linus", "holds"))).toEqual(["u3"]);
    expect(ids(filterMembers(ordered, ["u1", "u3"], "grace", "holds"))).toEqual([]);
  });
});

describe("assignmentChanges", () => {
  it("lists additions, then removals", () => {
    expect(assignmentChanges(["u1", "u4", "u5"], ["u1", "u2", "u3"])).toEqual([
      { userId: "u4", add: true },
      { userId: "u5", add: true },
      { userId: "u2", add: false },
      { userId: "u3", add: false },
    ]);
  });

  it("is empty when nothing differs", () => {
    expect(assignmentChanges(["u1", "u2"], ["u2", "u1"])).toEqual([]);
  });
});

describe("applyChanges", () => {
  it("adds and removes what went through", () => {
    const held = applyChanges(
      ["u1", "u2"],
      [
        { userId: "u3", add: true },
        { userId: "u1", add: false },
      ],
    );
    expect(held.sort()).toEqual(["u2", "u3"]);
  });

  it("keeps a holder that is added twice once", () => {
    expect(applyChanges(["u1"], [{ userId: "u1", add: true }])).toEqual(["u1"]);
  });
});

describe("uniqueSuggestions", () => {
  it("keeps one suggestion per key, in the place of the first, with the data of the last", () => {
    const first = suggestion("React", "s1");
    const second = { ...suggestion("React again", "s1"), reason: "later" };
    const named = suggestion(" Vue ");
    const sameName = suggestion("vue");
    expect(uniqueSuggestions([first, second, named, sameName])).toEqual([second, sameName]);
  });
});

describe("suggestionsToApply", () => {
  const roleSkills = [react];
  const all = [
    suggestion("React", "s1"),
    suggestion("Vue"),
    suggestion("  react  "),
    suggestion("Svelte"),
    suggestion("Solid", "s9"),
  ];
  const keys = new Set(["s1", "new:vue", "new:react", "s9"]);

  it("keeps the ticked ones the role does not carry", () => {
    expect(suggestionsToApply(all, keys, roleSkills).map((entry) => entry.name)).toEqual([
      "Vue",
      "Solid",
    ]);
  });

  it("leaves out one that is not ticked", () => {
    expect(suggestionsToApply(all, new Set(["new:vue"]), roleSkills)).toHaveLength(1);
    expect(suggestionsToApply(all, new Set(), roleSkills)).toEqual([]);
  });

  it("recognises a carried skill by id even under another name", () => {
    const renamed = suggestion("Something else", "s1");
    expect(suggestionsToApply([renamed], new Set(["s1"]), roleSkills)).toEqual([]);
  });
});

describe("failedMemberNames", () => {
  it("names the member, or a placeholder for an unknown one", () => {
    const failed = [
      { userId: "u1", add: true },
      { userId: "missing", add: false },
    ];
    expect(failedMemberNames(failed, users)).toEqual(["Ada Lovelace", "a member"]);
  });

  it("trims a name that has no last name", () => {
    const single = user("u7", "Cher", "", []);
    expect(failedMemberNames([{ userId: "u7", add: true }], [single])).toEqual(["Cher"]);
  });
});
