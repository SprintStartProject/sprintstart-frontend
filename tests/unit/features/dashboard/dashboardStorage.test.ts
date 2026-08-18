import { describe, it, expect, beforeEach } from "vitest";
import {
  clearStoredLayout,
  readStoredLayout,
  storeLayout,
} from "../../../../src/features/dashboard/layout/storage";
import type {
  DashboardLayout,
  DashboardWidgetId,
} from "../../../../src/features/dashboard/layout/types";

const KNOWN_IDS: DashboardWidgetId[] = ["greeting", "skills", "team-insights"];
const KEY = "sprintstart:dashboard-layout:user-1";

const LAYOUT: DashboardLayout = [
  { id: "greeting", size: "wide" },
  { id: "skills", size: "small" },
];

describe("dashboard layout storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads back what it stored", () => {
    storeLayout("user-1", LAYOUT);

    expect(readStoredLayout("user-1", KNOWN_IDS)).toEqual(LAYOUT);
  });

  it("keeps one user's arrangement out of another's", () => {
    storeLayout("user-1", LAYOUT);

    expect(readStoredLayout("user-2", KNOWN_IDS)).toBeNull();
  });

  it("reports no preference when nothing was ever stored", () => {
    expect(readStoredLayout("user-1", KNOWN_IDS)).toBeNull();
  });

  it("ignores a layout written by an older version of the format", () => {
    // v1 allowed sizes v2 has no grid for, so the whole arrangement is dropped rather than
    // losing those cards one at a time.
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, items: LAYOUT }));

    expect(readStoredLayout("user-1", KNOWN_IDS)).toBeNull();
  });

  it("survives hand-edited storage rather than taking the dashboard down", () => {
    window.localStorage.setItem(KEY, "not json at all");
    expect(readStoredLayout("user-1", KNOWN_IDS)).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, items: "nope" }));
    expect(readStoredLayout("user-1", KNOWN_IDS)).toBeNull();
  });

  it("drops entries the catalog no longer knows, and sizes that are not sizes", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        items: [
          { id: "greeting", size: "wide" },
          { id: "a-widget-that-was-deleted", size: "medium" },
          { id: "skills", size: "enormous" },
          null,
        ],
      }),
    );

    expect(readStoredLayout("user-1", KNOWN_IDS)).toEqual([{ id: "greeting", size: "wide" }]);
  });

  it("forgets the arrangement on clear, so the default applies again", () => {
    storeLayout("user-1", LAYOUT);
    clearStoredLayout("user-1");

    expect(readStoredLayout("user-1", KNOWN_IDS)).toBeNull();
  });

  it("stores nothing for a user without an id, rather than under a shared key", () => {
    storeLayout("", LAYOUT);

    expect(window.localStorage.length).toBe(0);
  });
});
