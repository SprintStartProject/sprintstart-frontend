import { describe, expect, it } from "vitest";
import {
  applyProjectToUsers,
  drawerOriginName,
  handedOffKeys,
  initialAdminTab,
  readDeepLink,
  requestedAdminTab,
  resolveDeepLink,
  visibleAdminTabs,
  withoutId,
} from "../../../../src/features/admin/page/pageRules";
import type {
  AdminProjectDetails,
  AdminUser,
  ProjectOverview,
} from "../../../../src/features/admin/types";

function user(
  id: string,
  firstName: string,
  lastName: string,
  projects: AdminUser["projects"] = [],
) {
  return { id, firstName, lastName, username: id, email: `${id}@x.io`, projects } as AdminUser;
}

function project(id: string, name: string, users: { id: string }[] = []) {
  return { id, name, users } as unknown as ProjectOverview;
}

const ada = user("u1", "Ada", "Lovelace");
const grace = user("u2", "Grace", "Hopper", [{ id: "p1", name: "Old name" }]);
const alpha = project("p1", "Alpha");
const beta = project("p2", "Beta");

const params = (query: string) => new URLSearchParams(query);

describe("visibleAdminTabs", () => {
  it("hides the skills tab from everybody but admins", () => {
    expect(visibleAdminTabs("ADMIN")).toEqual(["users", "projects", "skills", "tokens"]);
    expect(visibleAdminTabs("HR")).toEqual(["users", "projects", "tokens"]);
    expect(visibleAdminTabs(undefined)).toEqual(["users", "projects", "tokens"]);
  });
});

describe("readDeepLink", () => {
  it("reads a project, a user, or both", () => {
    expect(readDeepLink(params("projectId=p1"))).toEqual({ projectId: "p1", userId: null });
    expect(readDeepLink(params("userId=u1"))).toEqual({ projectId: null, userId: "u1" });
    expect(readDeepLink(params("projectId=p1&userId=u1"))).toEqual({
      projectId: "p1",
      userId: "u1",
    });
  });

  it("is none for a link that names neither, or names them empty", () => {
    expect(readDeepLink(params("tab=projects"))).toBeNull();
    expect(readDeepLink(params("projectId=&userId="))).toBeNull();
  });
});

describe("requestedAdminTab", () => {
  it("is the tab asked for when the group may see it", () => {
    const tabs = visibleAdminTabs("HR");
    expect(requestedAdminTab(params("tab=projects"), tabs)).toBe("projects");
    expect(requestedAdminTab(params("tab=skills"), tabs)).toBeUndefined();
    expect(requestedAdminTab(params("tab=nonsense"), tabs)).toBeUndefined();
    expect(requestedAdminTab(params(""), tabs)).toBeUndefined();
  });
});

describe("initialAdminTab", () => {
  it("prefers the tab asked for, then projects for a project link, then users", () => {
    expect(initialAdminTab("tokens", params("projectId=p1"))).toBe("tokens");
    expect(initialAdminTab(undefined, params("projectId=p1"))).toBe("projects");
    expect(initialAdminTab(undefined, params("userId=u1"))).toBe("users");
    expect(initialAdminTab(undefined, params(""))).toBe("users");
  });
});

describe("handedOffKeys", () => {
  it("strips all three on the first pass", () => {
    expect(handedOffKeys(params("tab=projects&projectId=p1&userId=u1&keep=1"), false)).toEqual([
      "tab",
      "projectId",
      "userId",
    ]);
  });

  it("strips only the tab afterwards, so a drawer link is not eaten while it is open", () => {
    expect(handedOffKeys(params("tab=projects&projectId=p1"), true)).toEqual(["tab"]);
  });

  it("strips nothing when none is there", () => {
    expect(handedOffKeys(params("keep=1"), false)).toEqual([]);
  });
});

describe("resolveDeepLink", () => {
  it("opens the project on the projects tab", () => {
    expect(resolveDeepLink({ projectId: "p2", userId: null }, [alpha, beta], [ada])).toEqual({
      project: beta,
      user: null,
      tab: "projects",
    });
  });

  it("opens the user on the users tab", () => {
    expect(resolveDeepLink({ projectId: null, userId: "u2" }, [alpha], [ada, grace])).toEqual({
      project: null,
      user: grace,
      tab: "users",
    });
  });

  it("lets the project win when both are named", () => {
    const target = resolveDeepLink({ projectId: "p1", userId: "u1" }, [alpha], [ada]);
    expect(target).toEqual({ project: alpha, user: null, tab: "projects" });
  });

  it("falls back to the user when the project is gone", () => {
    const target = resolveDeepLink({ projectId: "gone", userId: "u1" }, [alpha], [ada]);
    expect(target).toEqual({ project: null, user: ada, tab: "users" });
  });

  it("opens nothing for a link to something that no longer exists", () => {
    expect(resolveDeepLink({ projectId: "gone", userId: "gone" }, [alpha], [ada])).toBeNull();
  });
});

describe("drawerOriginName", () => {
  it("is none without an origin", () => {
    expect(drawerOriginName(null, [ada], [alpha])).toBeNull();
  });

  it("names the user or the project it came from", () => {
    expect(drawerOriginName({ kind: "user", id: "u1" }, [ada], [alpha])).toBe("Ada Lovelace");
    expect(drawerOriginName({ kind: "project", id: "p1" }, [ada], [alpha])).toBe("Alpha");
  });

  it("is none when the origin was deleted", () => {
    expect(drawerOriginName({ kind: "user", id: "gone" }, [ada], [alpha])).toBeNull();
    expect(drawerOriginName({ kind: "project", id: "gone" }, [ada], [alpha])).toBeNull();
  });
});

describe("applyProjectToUsers", () => {
  const updated = {
    ...alpha,
    name: "Alpha 2",
    users: [{ id: "u1" }, { id: "u2" }],
  } as unknown as AdminProjectDetails;

  it("adds the project to a new member and renames it for an existing one", () => {
    const [first, second] = applyProjectToUsers([ada, grace], updated);
    expect(first.projects).toEqual([{ id: "p1", name: "Alpha 2" }]);
    expect(second.projects).toEqual([{ id: "p1", name: "Alpha 2" }]);
  });

  it("keeps a member's projects alphabetical", () => {
    const busy = user("u1", "Ada", "Lovelace", [{ id: "p9", name: "Zed" }]);
    const [first] = applyProjectToUsers([busy], updated);
    expect(first.projects.map((entry) => entry.name)).toEqual(["Alpha 2", "Zed"]);
  });

  it("takes the project from someone who is no longer a member", () => {
    const removed = { ...updated, users: [] } as unknown as AdminProjectDetails;
    const [first] = applyProjectToUsers([grace], removed);
    expect(first.projects).toEqual([]);
  });

  it("leaves everyone else as they are", () => {
    const stranger = user("u9", "Not", "Involved", [{ id: "p5", name: "Other" }]);
    expect(applyProjectToUsers([stranger], updated)[0]).toBe(stranger);
  });
});

describe("withoutId", () => {
  it("copies the set without the id", () => {
    const ids = new Set(["a", "b"]);
    const next = withoutId(ids, "a");
    expect([...next]).toEqual(["b"]);
    expect([...ids]).toEqual(["a", "b"]);
  });
});
