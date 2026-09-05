import { describe, it, expect } from "vitest";
import {
  buildDefaultLayout,
  moveWidgetBy,
  moveWidgetTo,
  reconcileLayout,
  removeWidget,
  resizeWidget,
  setPlacedWidgets,
} from "../../../../src/features/dashboard/layout/layoutOperations";
import type {
  DashboardLayout,
  DashboardWidgetDefinition,
  DashboardWidgetId,
} from "../../../../src/features/dashboard/layout/types";

const EVERY_USER_WIDGET: DashboardWidgetId[] = [
  "greeting",
  "recent-chats",
  "knowledge-base",
  "ask-chat",
  "skills",
];

const ids = (layout: DashboardLayout) => layout.map((item) => item.id);

const definition = (id: DashboardWidgetId): DashboardWidgetDefinition =>
  ({ id, defaultSize: "medium" }) as DashboardWidgetDefinition;

describe("buildDefaultLayout", () => {
  it("reproduces the dashboard a plain user has always had", () => {
    expect(ids(buildDefaultLayout(EVERY_USER_WIDGET))).toEqual([
      "greeting",
      "recent-chats",
      "knowledge-base",
      "ask-chat",
      "skills",
    ]);
  });

  // The swap a user gets the first time somebody puts a component in their name. Work that is
  // assigned outranks a reading list, and the board is a fixed shape -- a card added here is a
  // card pushed off the first screen, so the gaps card takes the knowledge base's place.
  it("puts the gaps card where the knowledge base was for a user who owns something", () => {
    const layout = buildDefaultLayout([...EVERY_USER_WIDGET, "my-knowledge-gaps"], true);

    expect(ids(layout)).toEqual([
      "greeting",
      "recent-chats",
      "my-knowledge-gaps",
      "ask-chat",
      "skills",
    ]);
  });

  it("leaves the board alone for a user who owns nothing", () => {
    const layout = buildDefaultLayout([...EVERY_USER_WIDGET, "my-knowledge-gaps"], false);

    expect(ids(layout)).toContain("knowledge-base");
    expect(ids(layout)).not.toContain("my-knowledge-gaps");
  });

  it("does not take a slot that was not being filled anyway", () => {
    // No knowledge base to stand in for, so there is nothing to swap: the gaps card would
    // otherwise land in a position the default layout never used.
    const layout = buildDefaultLayout(["greeting", "ask-chat", "my-knowledge-gaps"], true);

    expect(ids(layout)).toEqual(["greeting", "ask-chat"]);
  });

  it("gives the slot to a running onboarding ahead of everything else", () => {
    const layout = buildDefaultLayout([...EVERY_USER_WIDGET, "onboarding", "team-insights"]);

    expect(ids(layout)).toEqual(["greeting", "onboarding", "knowledge-base", "ask-chat", "skills"]);
  });

  it("gives it to the team insights for a manager who is past their onboarding", () => {
    const layout = buildDefaultLayout([...EVERY_USER_WIDGET, "team-insights"]);

    expect(ids(layout)).toContain("team-insights");
    expect(ids(layout)).not.toContain("recent-chats");
  });

  it("places nothing the user may not have", () => {
    const layout = buildDefaultLayout(["greeting", "knowledge-base"]);

    expect(ids(layout)).toEqual(["greeting", "knowledge-base"]);
  });
});

describe("reconcileLayout", () => {
  it("drops a widget the user may no longer have", () => {
    const layout: DashboardLayout = [
      { id: "greeting", size: "wide" },
      { id: "team-insights", size: "medium" },
    ];

    expect(ids(reconcileLayout(layout, ["greeting"]))).toEqual(["greeting"]);
  });

  it("keeps only the first of a duplicated widget", () => {
    const layout: DashboardLayout = [
      { id: "greeting", size: "wide" },
      { id: "greeting", size: "medium" },
    ];

    expect(reconcileLayout(layout, ["greeting"])).toEqual([{ id: "greeting", size: "wide" }]);
  });
});

describe("setPlacedWidgets", () => {
  const available = EVERY_USER_WIDGET.map(definition);

  it("keeps what stays exactly where and how it was", () => {
    const layout: DashboardLayout = [
      { id: "greeting", size: "wide" },
      { id: "knowledge-base", size: "small" },
      { id: "ask-chat", size: "wide" },
    ];

    // The picker is a dialog over the board: reopening it must not quietly re-sort or resize
    // the things somebody has already arranged.
    const next = setPlacedWidgets(layout, new Set(["greeting", "ask-chat"]), available);

    expect(next).toEqual([
      { id: "greeting", size: "wide" },
      { id: "ask-chat", size: "wide" },
    ]);
  });

  it("appends what is new, in catalog order, at its default size", () => {
    const layout: DashboardLayout = [{ id: "greeting", size: "wide" }];

    const next = setPlacedWidgets(
      layout,
      new Set(["greeting", "skills", "recent-chats"]),
      available,
    );

    expect(next).toEqual([
      { id: "greeting", size: "wide" },
      { id: "recent-chats", size: "medium" },
      { id: "skills", size: "medium" },
    ]);
  });

  it("empties the board when nothing is ticked", () => {
    const layout: DashboardLayout = [{ id: "greeting", size: "wide" }];

    expect(setPlacedWidgets(layout, new Set(), available)).toEqual([]);
  });
});

describe("removeWidget and resizeWidget", () => {
  const layout: DashboardLayout = [
    { id: "greeting", size: "wide" },
    { id: "skills", size: "wide" },
  ];

  it("removes just the one widget", () => {
    expect(ids(removeWidget(layout, "greeting"))).toEqual(["skills"]);
  });

  it("resizes just the one widget", () => {
    expect(resizeWidget(layout, "skills", "small")).toEqual([
      { id: "greeting", size: "wide" },
      { id: "skills", size: "small" },
    ]);
  });
});

describe("moveWidgetTo", () => {
  const layout: DashboardLayout = [
    { id: "greeting", size: "wide" },
    { id: "recent-chats", size: "medium" },
    { id: "skills", size: "wide" },
  ];

  it("drops the widget where the target sits and pushes the rest along", () => {
    expect(ids(moveWidgetTo(layout, "skills", "greeting"))).toEqual([
      "skills",
      "greeting",
      "recent-chats",
    ]);
  });

  it("returns the same array when nothing would change, so a drag can call it per pixel", () => {
    expect(moveWidgetTo(layout, "greeting", "greeting")).toBe(layout);
    expect(moveWidgetTo(layout, "greeting", "team-insights")).toBe(layout);
  });
});

describe("moveWidgetBy", () => {
  const layout: DashboardLayout = [
    { id: "greeting", size: "wide" },
    { id: "recent-chats", size: "medium" },
    { id: "skills", size: "wide" },
  ];

  it("shifts a widget one place in either direction", () => {
    expect(ids(moveWidgetBy(layout, "greeting", 1))).toEqual([
      "recent-chats",
      "greeting",
      "skills",
    ]);
    expect(ids(moveWidgetBy(layout, "skills", -1))).toEqual(["greeting", "skills", "recent-chats"]);
  });

  it("stops at both ends rather than wrapping around", () => {
    expect(moveWidgetBy(layout, "greeting", -1)).toBe(layout);
    expect(moveWidgetBy(layout, "skills", 1)).toBe(layout);
  });
});
