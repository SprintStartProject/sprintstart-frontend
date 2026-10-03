import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE,
  DRAWER_CLOSE_DELAY_MS,
  PERMISSION_GROUP_OPTIONS,
  USER_FILTER_OPTIONS,
  getDisplayName,
  getPermissionGroupVariant,
  getSourceStatusVariant,
  getProjectUsersCount,
  getProjectSourcesCount,
  getUserEditFormState,
  getDraftDisplayName,
  enrichUsersWithProjectNames,
  filterAdminProjects,
  getSourceHealth,
  getSourceTypeLabel,
  groupSourcesByType,
  matchesUserSearch,
  pluralize,
} from "../../../../src/features/admin/data";
import type {
  AdminUser,
  ProjectOverview,
  UserEditFormState,
} from "../../../../src/features/admin/types";

function createAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "u1",
    authId: "auth1",
    username: "testuser",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    roles: [],
    permissionGroup: "ADMIN",
    projects: [],
    projectIds: [],
    enabled: true,
    profileIcon: "icon",
    hasCompletedOnboarding: true,
    ...overrides,
  };
}

describe("admin data helpers", () => {
  describe("constants", () => {
    it("exports a page size of 8", () => {
      expect(PAGE_SIZE).toBe(8);
    });

    it("exports the drawer close delay in ms", () => {
      expect(DRAWER_CLOSE_DELAY_MS).toBeGreaterThan(0);
    });

    it("exports permission group options", () => {
      expect(PERMISSION_GROUP_OPTIONS).toContain("Admin");
      expect(PERMISSION_GROUP_OPTIONS).toContain("User");
      expect(PERMISSION_GROUP_OPTIONS).toContain("Project Manager");
    });

    it("exports user filter options with value/label pairs", () => {
      expect(USER_FILTER_OPTIONS.length).toBeGreaterThan(0);
      for (const option of USER_FILTER_OPTIONS) {
        expect(option).toHaveProperty("value");
        expect(option).toHaveProperty("label");
        expect(typeof option.label).toBe("string");
      }
    });
  });

  describe("getDisplayName", () => {
    it("returns the full name when first and last name are present", () => {
      expect(getDisplayName(createAdminUser({ firstName: "Jane", lastName: "Doe" }))).toBe(
        "Jane Doe",
      );
    });

    it("falls back to username when name parts are empty", () => {
      expect(
        getDisplayName(createAdminUser({ firstName: "", lastName: "", username: "janedoe" })),
      ).toBe("janedoe");
    });

    it("falls back to email when name and username are empty", () => {
      expect(
        getDisplayName(
          createAdminUser({ firstName: "", lastName: "", username: "", email: "jane@x.com" }),
        ),
      ).toBe("jane@x.com");
    });
  });

  describe("getPermissionGroupVariant", () => {
    it("returns warning for ADMIN (case-insensitive)", () => {
      expect(getPermissionGroupVariant("admin")).toBe("warning");
      expect(getPermissionGroupVariant("ADMIN")).toBe("warning");
    });

    it("returns success for PROJECT_MANAGER", () => {
      expect(getPermissionGroupVariant("PROJECT_MANAGER")).toBe("success");
    });

    it("returns neutral for USER", () => {
      expect(getPermissionGroupVariant("USER")).toBe("neutral");
    });
  });

  describe("getSourceStatusVariant", () => {
    it("returns success for CONNECTED", () => {
      expect(getSourceStatusVariant("CONNECTED")).toBe("success");
    });

    it("returns warning for INDEXING", () => {
      expect(getSourceStatusVariant("INDEXING")).toBe("warning");
    });

    it("returns danger for ERROR", () => {
      expect(getSourceStatusVariant("ERROR")).toBe("danger");
    });

    it("returns neutral for DISCONNECTED", () => {
      expect(getSourceStatusVariant("DISCONNECTED")).toBe("neutral");
    });

    it("returns brand for unknown status", () => {
      expect(getSourceStatusVariant("UNKNOWN")).toBe("brand");
    });
  });

  describe("getProjectUsersCount / getProjectSourcesCount", () => {
    it("returns the users array length", () => {
      expect(getProjectUsersCount({ users: [1, 2, 3] })).toBe(3);
    });

    it("returns the sources array length", () => {
      expect(getProjectSourcesCount({ sources: ["a"] })).toBe(1);
    });
  });

  describe("getUserEditFormState", () => {
    it("extracts the editable fields from an AdminUser", () => {
      const user = createAdminUser({
        email: "new@x.com",
        firstName: "Jane",
        lastName: "Doe",
        permissionGroup: "PM",
        enabled: false,
      });
      const state = getUserEditFormState(user);
      expect(state).toEqual<UserEditFormState>({
        email: "new@x.com",
        firstName: "Jane",
        lastName: "Doe",
        permissionGroup: "PM",
        enabled: false,
      });
    });
  });

  describe("getDraftDisplayName", () => {
    it("prefers the draft name over the persisted username", () => {
      const user = createAdminUser({ username: "olduser" });
      const draft: UserEditFormState = {
        email: "jane@x.com",
        firstName: "Jane",
        lastName: "Doe",
        permissionGroup: "USER",
        enabled: true,
      };
      expect(getDraftDisplayName(user, draft)).toBe("Jane Doe");
    });

    it("falls back to the user username when draft names are empty", () => {
      const user = createAdminUser({ username: "persisted" });
      const draft: UserEditFormState = {
        email: "jane@x.com",
        firstName: "",
        lastName: "",
        permissionGroup: "USER",
        enabled: true,
      };
      expect(getDraftDisplayName(user, draft)).toBe("persisted");
    });

    it("falls back to draft email when username and draft names are empty", () => {
      const user = createAdminUser({ username: "" });
      const draft: UserEditFormState = {
        email: "fallback@x.com",
        firstName: "",
        lastName: "",
        permissionGroup: "USER",
        enabled: true,
      };
      expect(getDraftDisplayName(user, draft)).toBe("fallback@x.com");
    });
  });

  describe("enrichUsersWithProjectNames", () => {
    it("resolves the assigned project ids into named projects", () => {
      const user = createAdminUser({ projectIds: ["p2", "p1"] });

      const [enriched] = enrichUsersWithProjectNames(
        [user],
        [
          { id: "p1", name: "Alpha" },
          { id: "p2", name: "Beta" },
        ],
      );

      expect(enriched.projects).toEqual([
        { id: "p2", name: "Beta" },
        { id: "p1", name: "Alpha" },
      ]);
    });

    it("keeps an unknown project id visible with a placeholder name", () => {
      const user = createAdminUser({ projectIds: ["deleted-1234-5678"] });

      const [enriched] = enrichUsersWithProjectNames([user], []);

      expect(enriched.projects).toEqual([{ id: "deleted-1234-5678", name: "Project deleted-" }]);
    });

    it("falls back to already resolved projects when no ids are set", () => {
      const user = createAdminUser({
        projectIds: [],
        projects: [{ id: "p1", name: "Alpha" }],
      });

      const [enriched] = enrichUsersWithProjectNames([user], []);

      expect(enriched.projects).toEqual([{ id: "p1", name: "Alpha" }]);
    });
  });

  describe("matchesUserSearch", () => {
    const person = {
      firstName: "Jane",
      lastName: "Doe",
      username: "jane.d",
      email: "jane@example.com",
    };

    it("matches everyone on an empty term", () => {
      expect(matchesUserSearch(person, "   ")).toBe(true);
    });

    it("finds the username even though an email exists", () => {
      expect(matchesUserSearch(person, "jane.d")).toBe(true);
      expect(matchesUserSearch(person, "ne.d")).toBe(true);
    });

    it("matches the full name, the email and ignores case", () => {
      expect(matchesUserSearch(person, "Jane Doe")).toBe(true);
      expect(matchesUserSearch(person, "EXAMPLE.COM")).toBe(true);
    });

    it("does not match unrelated text", () => {
      expect(matchesUserSearch(person, "tom")).toBe(false);
    });

    it("tolerates missing fields", () => {
      expect(matchesUserSearch({ username: "solo" }, "solo")).toBe(true);
      expect(matchesUserSearch({ username: "solo" }, "x")).toBe(false);
    });
  });

  describe("filterAdminProjects", () => {
    const base: ProjectOverview = {
      id: "p1",
      name: "Alpha",
      description: "First",
      manager: null,
      sources: [],
      users: [],
      industry: "",
      industryConfidence: null,
      industryCustom: false,
    };
    const withManager: ProjectOverview = {
      ...base,
      id: "p2",
      name: "Beta",
      industry: "Fintech",
      manager: {
        id: "m1",
        username: "mara.k",
        email: "mara@example.com",
        firstName: "Mara",
        lastName: "Keller",
      },
    };

    it("finds a project by its manager's name or username", () => {
      expect(filterAdminProjects([base, withManager], "Mara Keller")).toEqual([withManager]);
      expect(filterAdminProjects([base, withManager], "mara.k")).toEqual([withManager]);
    });

    it("finds a project by its industry", () => {
      expect(filterAdminProjects([base, withManager], "fintech")).toEqual([withManager]);
    });

    it("returns every project on an empty search", () => {
      expect(filterAdminProjects([base, withManager], "")).toHaveLength(2);
    });
  });

  describe("pluralize", () => {
    it("uses the singular only for exactly one", () => {
      expect(pluralize(0, "member")).toBe("0 members");
      expect(pluralize(1, "member")).toBe("1 member");
      expect(pluralize(2, "source")).toBe("2 sources");
    });
  });

  describe("getSourceHealth", () => {
    it("reports no sources", () => {
      expect(getSourceHealth([])).toMatchObject({ state: "none", label: "No sources" });
    });

    it("is healthy when every source is connected", () => {
      expect(getSourceHealth([{ status: "CONNECTED" }, { status: "CONNECTED" }])).toMatchObject({
        state: "healthy",
        label: "All synced",
      });
    });

    it("counts failed, disconnected and disabled sources as needing attention", () => {
      const health = getSourceHealth([
        { status: "FAILED" },
        { status: "DISCONNECTED" },
        { status: "DISABLED" },
        { status: "CONNECTED" },
      ]);

      expect(health).toMatchObject({
        state: "attention",
        attentionCount: 3,
        label: "3 need attention",
      });
    });

    it("lets attention win over syncing, and keeps out-of-date apart from failures", () => {
      expect(getSourceHealth([{ status: "UPDATING" }, { status: "ERROR" }]).state).toBe(
        "attention",
      );
      expect(getSourceHealth([{ status: "UPDATING" }, { status: "CONNECTED" }]).state).toBe(
        "syncing",
      );
      expect(getSourceHealth([{ status: "OUT_OF_DATE" }, { status: "CONNECTED" }])).toMatchObject({
        state: "stale",
        label: "1 out of date",
      });
    });
  });

  describe("groupSourcesByType", () => {
    it("counts sources per type regardless of case, in order of first appearance", () => {
      expect(groupSourcesByType([{ type: "JIRA" }, { type: "GITHUB" }, { type: "jira" }])).toEqual([
        { type: "JIRA", label: "Jira", count: 2 },
        { type: "GITHUB", label: "GitHub", count: 1 },
      ]);
    });
  });

  describe("getSourceTypeLabel", () => {
    it("uses the shared source label", () => {
      expect(getSourceTypeLabel("GITHUB")).toBe("GitHub");
      expect(getSourceTypeLabel("jira")).toBe("Jira");
    });

    it("title-cases an unknown type", () => {
      expect(getSourceTypeLabel("SONARQUBE")).toBe("Sonarqube");
      expect(getSourceTypeLabel("custom_thing")).toBe("Custom Thing");
    });
  });
});
