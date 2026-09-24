import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dropLegacySelection,
  readStoredProjectId,
  storeProjectId,
} from "../../../../src/features/projects/projectSelectionStorage";

const BASE_KEY = "sprintstart:selected-project-id";

describe("projectSelectionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("remembers each user's own project", () => {
    storeProjectId("user-a", "p1");
    storeProjectId("user-b", "p2");

    expect(readStoredProjectId("user-a")).toBe("p1");
    expect(readStoredProjectId("user-b")).toBe("p2");
  });

  it("hands a user with no stored selection nothing to restore", () => {
    storeProjectId("user-a", "p1");

    expect(readStoredProjectId("user-b")).toBe("");
  });

  it("forgets the project when handed an empty ID instead of storing a blank one", () => {
    storeProjectId("user-a", "p1");
    storeProjectId("user-a", "");

    expect(readStoredProjectId("user-a")).toBe("");
    expect(window.localStorage.getItem(`${BASE_KEY}:user-a`)).toBeNull();
  });

  it("reads and writes nothing without a user to attribute it to", () => {
    storeProjectId("", "p1");

    expect(window.localStorage.length).toBe(0);
    expect(readStoredProjectId("")).toBe("");
  });

  it("survives storage that refuses to answer", () => {
    storeProjectId("user-a", "p1");

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(readStoredProjectId("user-a")).toBe("");

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => storeProjectId("user-a", "p2")).not.toThrow();
  });

  it("drops the unscoped selection older versions of the app wrote", () => {
    window.localStorage.setItem(BASE_KEY, "previous-persons-project");

    dropLegacySelection();

    expect(window.localStorage.getItem(BASE_KEY)).toBeNull();
    // Dropped, never adopted: it cannot be attributed to the user now signed in.
    expect(readStoredProjectId("user-a")).toBe("");
  });

  it("keeps quiet when the unscoped entry cannot be removed", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => dropLegacySelection()).not.toThrow();
  });
});
