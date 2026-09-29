import { describe, expect, it } from "vitest";
import {
  canJoinMultipleProjects,
  getProjectsLeftOnMove,
  isManagerEligible,
} from "../../../../src/features/admin/projectMove";
import type { AdminUser } from "../../../../src/features/admin/types";

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
