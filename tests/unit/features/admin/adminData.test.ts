import { describe, expect, it } from "vitest";
import {
  areAllVisibleUsersSelected,
  filterAdminProjects,
  filterAdminUsers,
  filterSkills,
  getPaginatedProjects,
  getPaginatedSkills,
  getPaginatedUsers,
  getSafePage,
  getSkillCategories,
  getSkillRoleNames,
  getTotalPages,
  removeUsersFromProjects,
  toggleSelectedUserId,
  toggleVisibleUserSelection,
} from "../../../../src/features/admin/data";
import type {
  AdminUser,
  ProjectOverview,
  ProjectRole,
  Skill,
} from "../../../../src/features/admin/types";

const users: AdminUser[] = [
  {
    id: "user-1",
    username: "john.doe",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    roles: [{ id: "role-dev", name: "Developer", description: "", type: "primary" }],
    permissionGroup: "Admin",
    projects: [{ id: "project-1", name: "SprintStart" }],
    projectIds: ["project-1"],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: true,
  },
  {
    id: "user-2",
    username: "jane.smith",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Smith",
    roles: [{ id: "role-qa", name: "QA", description: "", type: "primary" }],
    permissionGroup: "User",
    projects: [],
    projectIds: [],
    enabled: false,
    profileIcon: "",
    hasCompletedOnboarding: false,
  },
];

const projects: ProjectOverview[] = [
  {
    id: "project-1",
    name: "SprintStart",
    description: "Knowledge onboarding",
    manager: null,
    sources: [{ id: "source-1", name: "Repo", type: "GITHUB", status: "CONNECTED" }],
    users: [
      {
        id: "user-1",
        username: "john.doe",
        email: "john@example.com",
        projectRoles: ["MEMBER"],
      },
    ],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
  },
];

describe("admin data helpers", () => {
  it("filters users by search and status without mutating source users", () => {
    expect(filterAdminUsers(users, "qa", "all")).toEqual([users[1]]);
    expect(filterAdminUsers(users, "", "disabled")).toEqual([users[1]]);
    expect(filterAdminUsers(users, "", "onboarded")).toEqual([users[0]]);
    expect(users).toHaveLength(2);
  });

  it("filters projects by source and assigned user values", () => {
    expect(filterAdminProjects(projects, "github")).toEqual(projects);
    expect(filterAdminProjects(projects, "john")).toEqual(projects);
    expect(filterAdminProjects(projects, "missing")).toEqual([]);
  });

  it("paginates users and keeps page values within bounds", () => {
    expect(getTotalPages(17, 8)).toBe(3);
    expect(getSafePage(4, 3)).toBe(3);
    expect(getPaginatedUsers(users, 2, 1)).toEqual([users[1]]);
  });

  it("paginates projects by slicing the requested page", () => {
    expect(getPaginatedProjects(projects, 1, 1)).toEqual([projects[0]]);
    expect(getPaginatedProjects(projects, 2, 1)).toEqual([]);
  });

  it("toggles individual and visible user selections", () => {
    const selected = toggleSelectedUserId(new Set<string>(), "user-1");
    expect(selected.has("user-1")).toBe(true);

    const allSelected = toggleVisibleUserSelection(selected, users, false);
    expect(areAllVisibleUsersSelected(users, allSelected)).toBe(true);

    const noneSelected = toggleVisibleUserSelection(allSelected, users, true);
    expect(noneSelected.size).toBe(0);
  });

  it("removes users from project assignments immutably", () => {
    const updatedProjects = removeUsersFromProjects(projects, new Set(["user-1"]));

    expect(updatedProjects[0].users).toEqual([]);
    expect(projects[0].users).toHaveLength(1);
  });
});

describe("skill pool helpers", () => {
  const roles: ProjectRole[] = [
    { id: "role-1", name: "Frontend", description: "" },
    { id: "role-2", name: "Backend", description: "" },
  ];

  const skills: Skill[] = [
    {
      id: "skill-1",
      name: "React",
      roleIds: ["role-1"],
      status: "ACTIVE",
      category: "Engineering",
      universal: false,
    },
    {
      id: "skill-2",
      name: "Kubernetes",
      roleIds: ["role-2"],
      status: "RETIRED",
      category: "Ops",
      universal: false,
    },
    {
      id: "skill-3",
      name: "Communication",
      roleIds: [],
      status: "ACTIVE",
      category: null,
      universal: true,
    },
  ];

  it("resolves a skill's role ids to names, dropping ids with no matching role", () => {
    expect(getSkillRoleNames(skills[0], roles)).toEqual(["Frontend"]);
    expect(getSkillRoleNames({ ...skills[0], roleIds: ["role-1", "unknown"] }, roles)).toEqual([
      "Frontend",
    ]);
  });

  it("lists every distinct, non-null category alphabetically", () => {
    expect(getSkillCategories(skills)).toEqual(["Engineering", "Ops"]);
  });

  it("filters skills by name, status, category and role", () => {
    expect(filterSkills(skills, "react", "all", "all", "all")).toEqual([skills[0]]);
    expect(filterSkills(skills, "", "RETIRED", "all", "all")).toEqual([skills[1]]);
    expect(filterSkills(skills, "", "all", "Ops", "all")).toEqual([skills[1]]);
    expect(filterSkills(skills, "", "all", "all", "role-1")).toEqual([skills[0]]);
    expect(filterSkills(skills, "", "all", "all", "all")).toEqual(skills);
  });

  it("paginates skills by slicing the requested page", () => {
    expect(getPaginatedSkills(skills, 1, 2)).toEqual([skills[0], skills[1]]);
    expect(getPaginatedSkills(skills, 2, 2)).toEqual([skills[2]]);
  });
});
