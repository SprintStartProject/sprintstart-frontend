import { describe, expect, it } from "vitest";
import {
  canJoinMultipleProjects,
  getManagedProjectIds,
  getMovedUsers,
  getOtherProjectCount,
  getProjectsLeftOnMove,
  getRoleDowngradeConflicts,
  isManagerEligible,
} from "../../../../src/features/admin/projectMove";
import type { AdminUser, ProjectOverview } from "../../../../src/features/admin/types";

function buildUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-1",
    username: "john.doe",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    roles: [],
    permissionGroup: "User",
    projects: [{ id: "project-a", name: "Project A" }],
    projectIds: ["project-a"],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: false,
    ...overrides,
  };
}

describe("isManagerEligible", () => {
  it("accepts raw role codes and humanized labels in any casing", () => {
    expect(isManagerEligible("PM")).toBe(true);
    expect(isManagerEligible("admin")).toBe(true);
    expect(isManagerEligible("Project Manager")).toBe(true);
    expect(isManagerEligible(" PROJECT_MANAGER ")).toBe(true);
  });

  it("rejects other roles and missing signals", () => {
    expect(isManagerEligible("USER", "HR")).toBe(false);
    expect(isManagerEligible(undefined)).toBe(false);
    expect(isManagerEligible()).toBe(false);
  });

  it("is true as soon as one signal qualifies", () => {
    expect(isManagerEligible("USER", "PM")).toBe(true);
  });
});

const overview = (id: string, managerId?: string): ProjectOverview => ({
  id,
  name: `Project ${id}`,
  description: "",
  manager: managerId
    ? { id: managerId, username: "m", email: "", firstName: "", lastName: "" }
    : null,
  sources: [],
  users: [],
  industry: "",
  industryConfidence: null,
  industryCustom: false,
});

describe("getManagedProjectIds", () => {
  it("collects the projects the user is the manager of", () => {
    const projects = [overview("a", "user-1"), overview("b", "other"), overview("c")];

    expect(getManagedProjectIds(projects, "user-1")).toEqual(new Set(["a"]));
  });
});

describe("getRoleDowngradeConflicts", () => {
  const manager = buildUser({
    permissionGroup: "Project Manager",
    projects: [
      { id: "a", name: "Project a" },
      { id: "b", name: "Project b" },
    ],
    projectIds: ["a", "b"],
  });

  it("reports several memberships and managed projects when a PM becomes a user", () => {
    const conflicts = getRoleDowngradeConflicts(manager, [overview("a", "user-1")], "User");

    expect(conflicts).toEqual({
      projectCount: 2,
      managedProjects: [{ id: "a", name: "Project a" }],
    });
  });

  it("is silent when the new role can still hold the memberships", () => {
    expect(getRoleDowngradeConflicts(manager, [overview("a", "user-1")], "Admin")).toBeNull();
  });

  it("is silent for someone who was a regular user already", () => {
    expect(getRoleDowngradeConflicts(buildUser(), [], "User")).toBeNull();
  });

  it("is silent when one project and no managing is all that is left", () => {
    const single = buildUser({
      permissionGroup: "Admin",
      projects: [{ id: "a", name: "Project a" }],
      projectIds: ["a"],
    });

    expect(getRoleDowngradeConflicts(single, [overview("a")], "User")).toBeNull();
  });

  it("still reports a managed project when only one membership is left", () => {
    const single = buildUser({
      permissionGroup: "Project Manager",
      projects: [{ id: "a", name: "Project a" }],
      projectIds: ["a"],
    });

    expect(getRoleDowngradeConflicts(single, [overview("a", "user-1")], "User")).toEqual({
      projectCount: 0,
      managedProjects: [{ id: "a", name: "Project a" }],
    });
  });
});

describe("getOtherProjectCount", () => {
  it("counts the projects besides the given one", () => {
    const user = buildUser({ projectIds: ["project-a", "project-b", "project-c"], projects: [] });

    expect(getOtherProjectCount(user, "project-a")).toBe(2);
    expect(getOtherProjectCount(user, "project-z")).toBe(3);
  });

  it("reads the named projects when the ids are not filled in, without double counting", () => {
    const user = buildUser({
      projectIds: ["project-a"],
      projects: [
        { id: "project-a", name: "A" },
        { id: "project-b", name: "B" },
      ],
    });

    expect(getOtherProjectCount(user, "project-a")).toBe(1);
  });
});

describe("canJoinMultipleProjects", () => {
  it("allows PM and ADMIN", () => {
    expect(canJoinMultipleProjects("Project Manager")).toBe(true);
    expect(canJoinMultipleProjects("Admin")).toBe(true);
    expect(canJoinMultipleProjects("PM")).toBe(true);
  });

  it("treats HR and regular users as single-project", () => {
    expect(canJoinMultipleProjects("HR")).toBe(false);
    expect(canJoinMultipleProjects("User")).toBe(false);
    expect(canJoinMultipleProjects(undefined)).toBe(false);
  });
});

describe("getProjectsLeftOnMove", () => {
  it("returns the other projects of a regular user", () => {
    const user = buildUser({
      projects: [
        { id: "project-a", name: "Project A" },
        { id: "project-b", name: "Project B" },
      ],
    });

    expect(getProjectsLeftOnMove(user, "project-b")).toEqual([
      { id: "project-a", name: "Project A" },
    ]);
  });

  it("moves HR like a regular user", () => {
    const user = buildUser({ permissionGroup: "HR" });

    expect(getProjectsLeftOnMove(user, "project-b")).toEqual([
      { id: "project-a", name: "Project A" },
    ]);
  });

  it("is empty when the user is already in the target project only", () => {
    expect(getProjectsLeftOnMove(buildUser(), "project-a")).toEqual([]);
  });

  it("is empty for a user without any project", () => {
    const user = buildUser({ projects: [], projectIds: [] });

    expect(getProjectsLeftOnMove(user, "project-b")).toEqual([]);
  });

  it("is empty for PM and ADMIN, who keep every membership", () => {
    expect(getProjectsLeftOnMove(buildUser({ permissionGroup: "Project Manager" }), "b")).toEqual(
      [],
    );
    expect(getProjectsLeftOnMove(buildUser({ permissionGroup: "Admin" }), "b")).toEqual([]);
  });
});

describe("getMovedUsers", () => {
  const regular = buildUser({ id: "regular" });
  const manager = buildUser({ id: "manager", permissionGroup: "Project Manager" });
  const fresh = buildUser({ id: "fresh", projects: [], projectIds: [] });
  const users = [regular, manager, fresh];

  it("keeps only the users who would leave another project", () => {
    expect(getMovedUsers(users, ["regular", "manager", "fresh"], "project-b")).toEqual([
      { user: regular, leaving: [{ id: "project-a", name: "Project A" }] },
    ]);
  });

  it("ignores ids that match no known user", () => {
    expect(getMovedUsers(users, ["unknown"], "project-b")).toEqual([]);
  });

  it("does not count a user who is already in the target project", () => {
    expect(getMovedUsers(users, ["regular"], "project-a")).toEqual([]);
  });
});
