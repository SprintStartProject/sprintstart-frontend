import { describe, it, expect } from "vitest";
import {
  canSeeTeamInsights,
  summarizeGaps,
  topQuestions,
} from "../../../../src/features/dashboard/teamInsights";
import { PermissionGroup } from "../../../../src/services/types";
import type { UserProfile } from "../../../../src/services/types";
import type { FAQGroup } from "../../../../src/features/faq/types";
import type {
  KnowledgeGap,
  KnowledgeGapSeverity,
} from "../../../../src/features/knowledge-gaps/types";

const createProfile = (permissionGroup: PermissionGroup): UserProfile => ({
  id: "user-1",
  authId: "auth-1",
  username: "testuser",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds: [],
  permissionGroup,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: true,
});

const createGap = (component: string, severity: KnowledgeGapSeverity): KnowledgeGap => ({
  id: `${component}-${severity}`,
  component,
  missingTypes: [],
  lastIngested: "2026-08-01T00:00:00Z",
  refreshedAt: "2026-08-01T00:00:00Z",
  owners: [],
  severity,
});

const createGroup = (groupId: string, question: string, count: number): FAQGroup => ({
  groupId,
  // Entries carry a generated title alongside the representative question now.
  title: question,
  question,
  count,
  topDocuments: [],
});

describe("canSeeTeamInsights", () => {
  it("says no to a regular user", () => {
    expect(canSeeTeamInsights(createProfile(PermissionGroup.USER), true)).toBe(false);
  });

  it("says yes to an admin and to HR", () => {
    expect(canSeeTeamInsights(createProfile(PermissionGroup.ADMIN))).toBe(true);
    expect(canSeeTeamInsights(createProfile(PermissionGroup.HR))).toBe(true);
  });

  it("says yes to a PM only for a project they manage, since the widget would 403 otherwise", () => {
    expect(canSeeTeamInsights(createProfile(PermissionGroup.PM), true)).toBe(true);
    expect(canSeeTeamInsights(createProfile(PermissionGroup.PM), false)).toBe(false);
  });

  it("defaults a PM to no widget when the caller has no project context", () => {
    expect(canSeeTeamInsights(createProfile(PermissionGroup.PM))).toBe(false);
  });

  it("says no without a profile", () => {
    expect(canSeeTeamInsights(null, true)).toBe(false);
  });
});

describe("summarizeGaps", () => {
  it("counts gaps per severity and the distinct components they sit on", () => {
    const summary = summarizeGaps([
      createGap("auth", "high"),
      // Same component, second gap — one component, two gaps.
      createGap("auth", "low"),
      createGap("billing", "medium"),
      createGap("search", "low"),
    ]);

    expect(summary.total).toBe(4);
    expect(summary.componentCount).toBe(3);
    expect(summary.counts).toEqual({ high: 1, medium: 1, low: 2, covered: 0 });
  });

  it("always reports every severity, so the ring has no missing keys", () => {
    const summary = summarizeGaps([createGap("auth", "high")]);

    expect(summary.counts).toEqual({ high: 1, medium: 0, low: 0, covered: 0 });
  });

  // The overview is the project's full component roster now, but the ring answers how much
  // is outstanding -- a cleared component would inflate both the middle number and the
  // proportions around it.
  it("leaves covered components out of the ring and its middle number", () => {
    const summary = summarizeGaps([
      createGap("auth", "high"),
      createGap("billing", "covered"),
      createGap("search", "covered"),
    ]);

    expect(summary.total).toBe(1);
    expect(summary.componentCount).toBe(1);
    expect(summary.counts).toEqual({ high: 1, medium: 0, low: 0, covered: 0 });
  });

  it("summarizes an empty list to zeroes", () => {
    expect(summarizeGaps([])).toEqual({
      componentCount: 0,
      total: 0,
      counts: { high: 0, medium: 0, low: 0, covered: 0 },
    });
  });
});

describe("topQuestions", () => {
  it("puts the most asked question first and caps the list", () => {
    const top = topQuestions(
      [
        createGroup("g1", "How do I deploy?", 3),
        createGroup("g2", "Where is the runbook?", 9),
        createGroup("g3", "Who owns billing?", 5),
        createGroup("g4", "How do I get access?", 1),
      ],
      3,
    );

    expect(top.map((group) => group.question)).toEqual([
      "Where is the runbook?",
      "Who owns billing?",
      "How do I deploy?",
    ]);
  });

  it("keeps the backend's order on a tie", () => {
    const top = topQuestions([createGroup("g1", "First", 4), createGroup("g2", "Second", 4)], 3);

    expect(top.map((group) => group.groupId)).toEqual(["g1", "g2"]);
  });

  it("leaves the caller's array alone", () => {
    const groups = [createGroup("g1", "Rare", 1), createGroup("g2", "Common", 8)];

    topQuestions(groups, 3);

    expect(groups.map((group) => group.groupId)).toEqual(["g1", "g2"]);
  });

  it("returns an empty list when nothing has been asked", () => {
    expect(topQuestions([], 3)).toEqual([]);
  });
});
