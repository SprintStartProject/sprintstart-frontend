import { describe, expect, it } from "vitest";
import {
  isDraftDirty,
  isNameClashMessage,
  memberCountOf,
  nameState,
  nextPhase,
  ownerOptionsFor,
  phaseAtStep,
  previousPhase,
  resolveReviewManager,
  resolveReviewMembers,
  screenAnnouncementFor,
  skipLabelFor,
  stepIndexOf,
} from "../../../../../src/features/admin/components/wizard/wizardRules";
import type { AdminUser } from "../../../../../src/features/admin/types";

const user = (id: string, over: Partial<AdminUser> = {}) =>
  ({
    id,
    username: `user-${id}`,
    email: `${id}@x.io`,
    firstName: "",
    lastName: "",
    profileIcon: `icon-${id}`,
    ...over,
  }) as unknown as AdminUser;

describe("nameState", () => {
  it("is valid for a fresh name and shows no error", () => {
    expect(nameState("  Apollo ", ["Gemini"], false, "")).toEqual({
      trimmedName: "Apollo",
      isNameValid: true,
      nameError: "",
    });
  });

  it("flags a clash case-insensitively and ignores spaces around either side", () => {
    expect(nameState("apollo", ["  APOLLO "], false, "")).toMatchObject({
      isNameValid: false,
      nameError: "A project with this name already exists.",
    });
  });

  it("asks for a name only after the field was touched", () => {
    expect(nameState("", [], false, "")).toMatchObject({ isNameValid: false, nameError: "" });
    expect(nameState("   ", [], true, "")).toMatchObject({
      isNameValid: false,
      nameError: "Name is required.",
    });
    expect(nameState("x", [], true, "").nameError).toBe("");
  });

  it("lets the backend's conflict win over every other message", () => {
    expect(nameState("", ["a"], true, "taken on the server").nameError).toBe("taken on the server");
    expect(nameState("a", ["a"], true, "taken on the server").nameError).toBe(
      "taken on the server",
    );
  });

  it("does not call an empty name a clash with an empty existing name", () => {
    expect(nameState("", [""], false, "").isNameValid).toBe(false);
    expect(nameState("", [""], true, "").nameError).toBe("Name is required.");
  });
});

describe("isNameClashMessage", () => {
  it.each([
    "Project name already exists",
    "name is taken",
    "A project with that name exist",
    "the name is a duplicate",
    "NAME ALREADY IN USE",
  ])("recognises %s", (message) => {
    expect(isNameClashMessage(message)).toBe(true);
  });

  it.each(["Server exploded", "already exists", "Could not create the project"])(
    "ignores %s",
    (message) => {
      expect(isNameClashMessage(message)).toBe(false);
    },
  );
});

describe("isDraftDirty", () => {
  const empty = {
    name: "",
    description: "",
    industry: "",
    managerId: "",
    selectedUserIds: new Set<string>(),
    sourceCount: 0,
  };

  it("is clean for an empty draft and for whitespace only", () => {
    expect(isDraftDirty(empty)).toBe(false);
    expect(isDraftDirty({ ...empty, name: " ", description: " ", industry: "  " })).toBe(false);
  });

  it.each([
    ["name", { name: "a" }],
    ["description", { description: "a" }],
    ["industry", { industry: "a" }],
    ["manager", { managerId: "u1" }],
    ["members", { selectedUserIds: new Set(["u1"]) }],
    ["sources", { sourceCount: 1 }],
  ])("is dirty once the %s is set", (_label, over) => {
    expect(isDraftDirty({ ...empty, ...over })).toBe(true);
  });
});

describe("review people", () => {
  const users = [
    user("u1", { firstName: "Ada", lastName: "Lovelace" }),
    user("u2", { username: "grace" }),
    user("u3", { firstName: "Linus" }),
  ];

  it("has no manager without an id or when nobody matches", () => {
    expect(resolveReviewManager(users, [], "")).toBeNull();
    expect(resolveReviewManager(users, [], "missing")).toBeNull();
  });

  it("prefers the directory entry, with its profile icon", () => {
    expect(resolveReviewManager(users, [], "u1")).toEqual({
      id: "u1",
      name: "Ada Lovelace",
      profileIcon: "icon-u1",
    });
  });

  it("falls back to a candidate, by full name then username", () => {
    const candidate = (over: object) => ({
      id: "c1",
      username: "cand",
      email: "c@x.io",
      firstName: "Cy",
      lastName: "Candidate",
      ...over,
    });
    expect(resolveReviewManager(users, [candidate({})], "c1")).toEqual({
      id: "c1",
      name: "Cy Candidate",
    });
    expect(resolveReviewManager(users, [candidate({ firstName: "", lastName: "" })], "c1")).toEqual(
      {
        id: "c1",
        name: "cand",
      },
    );
  });

  it("lists picked members without the manager and notes where they move from", () => {
    const moved = [{ user: users[1], leaving: [{ id: "p", name: "Old project" }] }];
    const members = resolveReviewMembers(users, new Set(["u1", "u2"]), "u1", moved);
    expect(members).toEqual([
      { id: "u2", name: "grace", profileIcon: "icon-u2", movedFrom: ["Old project"] },
    ]);
  });
});

describe("memberCountOf and ownerOptionsFor", () => {
  const users = [
    user("u1", { firstName: "Zed" }),
    user("u2", { firstName: "Abe" }),
    user("u3", { firstName: "Moe" }),
  ];

  it("counts the manager as a member unless already ticked", () => {
    expect(memberCountOf(new Set(["u1", "u2"]), "")).toBe(2);
    expect(memberCountOf(new Set(["u1", "u2"]), "u1")).toBe(2);
    expect(memberCountOf(new Set(["u1", "u2"]), "u3")).toBe(3);
  });

  it("offers the picked people and the manager, sorted by name", () => {
    expect(ownerOptionsFor(users, new Set(["u1"]), "u3")).toEqual([
      { value: "u3", label: "Moe" },
      { value: "u1", label: "Zed" },
    ]);
    expect(ownerOptionsFor(users, new Set(), "")).toEqual([]);
  });
});

describe("phases", () => {
  it("moves forward and back along the four steps and stays put at the ends", () => {
    expect(nextPhase("details")).toBe("members");
    expect(nextPhase("members")).toBe("sources");
    expect(nextPhase("sources")).toBe("review");
    expect(nextPhase("review")).toBe("review");
    expect(nextPhase("provisioning")).toBe("provisioning");
    expect(previousPhase("review")).toBe("sources");
    expect(previousPhase("sources")).toBe("members");
    expect(previousPhase("members")).toBe("details");
    expect(previousPhase("details")).toBe("details");
    expect(previousPhase("provisioning")).toBe("provisioning");
  });

  it("maps stepper indexes to phases and back, keeping provisioning on the last step", () => {
    expect([0, 1, 2, 3].map(phaseAtStep)).toEqual(["details", "members", "sources", "review"]);
    expect(phaseAtStep(4)).toBeNull();
    expect(phaseAtStep(-1)).toBeNull();
    expect(stepIndexOf("details")).toBe(0);
    expect(stepIndexOf("review")).toBe(3);
    expect(stepIndexOf("provisioning")).toBe(3);
  });
});

describe("screenAnnouncementFor and skipLabelFor", () => {
  it("announces the step, the add-source sub-flow, or provisioning", () => {
    expect(screenAnnouncementFor("members", { isOpen: false, step: "type" })).toBe(
      "Step 2 of 4: Members",
    );
    expect(screenAnnouncementFor("sources", { isOpen: true, step: "type" })).toBe(
      "Add a source: choose a type",
    );
    expect(screenAnnouncementFor("sources", { isOpen: true, step: "details" })).toBe(
      "Add a source: enter the details",
    );
    expect(screenAnnouncementFor("provisioning", { isOpen: true, step: "type" })).toBe(
      "Creating project",
    );
  });

  it("names the shortcut by whether there are sources", () => {
    expect(skipLabelFor(0)).toBe("Create without sources");
    expect(skipLabelFor(2)).toBe("Create, skip review");
  });
});
