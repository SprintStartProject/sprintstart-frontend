import { describe, expect, it } from "vitest";
import { navItemState } from "../../../../src/components/layout/sidebar/navItemState";
import {
  ESCALATION_INBOX_PATH,
  isPmSectionActive,
  pmDashboardBadge,
} from "../../../../src/components/layout/sidebar/pmBadge";
import {
  buildSections,
  indicatorLayoutIdFor,
} from "../../../../src/components/layout/sidebar/sidebarSections";
import type { UserProfile } from "../../../../src/services/types";
import { PermissionGroup } from "../../../../src/services/types";

const profile = (permissionGroup: PermissionGroup) =>
  ({ id: "u1", permissionGroup }) as unknown as UserProfile;

const labels = (sections: ReturnType<typeof buildSections>) =>
  sections.map((section) => section.items.map((item) => item.label));

describe("pmDashboardBadge", () => {
  it("is null while any part is unknown", () => {
    expect(pmDashboardBadge(null, 0)).toBeNull();
    expect(pmDashboardBadge({ pendingSkips: 1, unreadFeedback: 0 }, null)).toBeNull();
    expect(pmDashboardBadge(null, null)).toBeNull();
  });

  it("adds the three parts and names the ones that are not zero", () => {
    expect(pmDashboardBadge({ pendingSkips: 2, unreadFeedback: 1 }, 3)).toEqual({
      count: 6,
      label:
        "6 items need your attention: 2 pending skip requests, 1 unread feedback, 3 open escalations",
    });
  });

  it("uses singular forms for one", () => {
    expect(pmDashboardBadge({ pendingSkips: 1, unreadFeedback: 0 }, 0)).toEqual({
      count: 1,
      label: "1 item needs your attention: 1 pending skip request",
    });
    expect(pmDashboardBadge({ pendingSkips: 0, unreadFeedback: 2 }, 1)?.label).toBe(
      "3 items need your attention: 2 unread feedback items, 1 open escalation",
    );
  });

  it("counts zero when there is nothing", () => {
    expect(pmDashboardBadge({ pendingSkips: 0, unreadFeedback: 0 }, 0)?.count).toBe(0);
  });
});

describe("isPmSectionActive", () => {
  it.each([
    "/pm-dashboard",
    "/team-management",
    "/team/abc",
    "/insights/faq",
    "/insights/knowledge-gaps",
    "/insights/onboarding",
    ESCALATION_INBOX_PATH,
    "/pm-dashboard/anything",
  ])("is active on %s", (path) => {
    expect(isPmSectionActive(path)).toBe(true);
  });

  it.each(["/", "/board", "/buddy", "/team", "/settings", "/insights"])(
    "is not active on %s",
    (path) => {
      expect(isPmSectionActive(path)).toBe(false);
    },
  );
});

describe("buildSections", () => {
  it("gives a regular user only the first section", () => {
    const sections = buildSections(profile(PermissionGroup.USER), false, true);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeUndefined();
    expect(labels(sections)[0]).toEqual([
      "Dashboard",
      "Board",
      "Buddy",
      "Knowledge Base",
      "OnBoarding",
    ]);
  });

  it("drops the onboarding entry once there is nothing to onboard", () => {
    const [first] = labels(buildSections(profile(PermissionGroup.USER), false, false));
    expect(first).not.toContain("OnBoarding");
    expect(first).toContain("Dashboard");
  });

  it("shows nothing without a profile", () => {
    expect(buildSections(null, true, true)).toEqual([]);
  });

  it("adds the admin section for an admin", () => {
    const sections = buildSections(profile(PermissionGroup.ADMIN), false, true);
    const admin = sections.find((section) => section.heading === "Admin");
    expect(admin?.items.map((item) => item.label)).toEqual(["Access Management"]);
  });

  it("adds the project manager section only while they manage the selected project", () => {
    const manager = profile(PermissionGroup.PM);
    const headings = (manages: boolean) =>
      buildSections(manager, manages, true).map((section) => section.heading);
    expect(headings(true)).toContain("Project Manager");
    const pm = buildSections(manager, true, true).find(
      (section) => section.heading === "Project Manager",
    );
    expect(pm?.items.map((item) => item.label)).toContain("PM Dashboard");
    expect(headings(false)).not.toContain("Admin");
  });
});

describe("indicatorLayoutIdFor", () => {
  const sections = buildSections(profile(PermissionGroup.USER), false, true);

  it("scopes the id to the instance", () => {
    expect(indicatorLayoutIdFor("a", sections)).not.toBe(indicatorLayoutIdFor("b", sections));
    expect(indicatorLayoutIdFor("a", sections)).toContain("sidebar-active-pill-a-");
  });

  it("changes with the visible entries and not otherwise", () => {
    const without = buildSections(profile(PermissionGroup.USER), false, false);
    expect(indicatorLayoutIdFor("a", sections)).toBe(indicatorLayoutIdFor("a", sections));
    expect(indicatorLayoutIdFor("a", sections)).not.toBe(indicatorLayoutIdFor("a", without));
    expect(indicatorLayoutIdFor("a", sections)).toContain("/|/board|/buddy");
  });
});

describe("navItemState", () => {
  const quiet = {
    hasPmAttentionItems: false,
    hasUnseenKnowledgeGaps: false,
    unseenSkipAnswerCount: 0,
    pmBadge: null,
    isOnboardingRunning: false,
    isPmSectionActive: false,
  };

  it("is quiet for an entry with nothing to say", () => {
    expect(navItemState("/board", { ...quiet, hasPmAttentionItems: true })).toMatchObject({
      forceActive: false,
      hasAttentionMarker: false,
      count: 0,
      countLabel: undefined,
      busy: false,
    });
  });

  it("marks the dashboard for unseen knowledge gaps and the onboarding entry for answered skips", () => {
    expect(navItemState("/", { ...quiet, hasUnseenKnowledgeGaps: true })).toMatchObject({
      hasAttentionMarker: true,
      attentionLabel: "A component has been assigned to you",
    });
    expect(navItemState("/", quiet).hasAttentionMarker).toBe(false);
    expect(navItemState("/onboarding", { ...quiet, unseenSkipAnswerCount: 1 })).toMatchObject({
      hasAttentionMarker: true,
      attentionLabel: "Your project manager answered a skip request",
    });
    expect(navItemState("/onboarding", quiet).hasAttentionMarker).toBe(false);
  });

  it("gives the PM dashboard its marker, count and label, and lets it stand in for its section", () => {
    const badge = { count: 4, label: "4 items need your attention" };
    const state = navItemState("/pm-dashboard", {
      ...quiet,
      hasPmAttentionItems: true,
      pmBadge: badge,
      isPmSectionActive: true,
    });
    expect(state).toMatchObject({
      forceActive: true,
      hasAttentionMarker: true,
      count: 4,
      attentionLabel: "Open skip requests, unread feedback or escalations",
    });
    expect(state.countLabel?.()).toBe("4 items need your attention");
    expect(navItemState("/pm-dashboard", quiet)).toMatchObject({
      forceActive: false,
      hasAttentionMarker: false,
      count: 0,
    });
  });

  it("keeps the badge off every other entry", () => {
    const badge = { count: 4, label: "x" };
    expect(navItemState("/", { ...quiet, pmBadge: badge })).toMatchObject({
      count: 0,
      countLabel: undefined,
    });
  });

  it("is busy only on the onboarding entry while the path is being built", () => {
    expect(navItemState("/onboarding", { ...quiet, isOnboardingRunning: true }).busy).toBe(true);
    expect(navItemState("/onboarding", quiet).busy).toBe(false);
    expect(navItemState("/board", { ...quiet, isOnboardingRunning: true }).busy).toBe(false);
  });
});
