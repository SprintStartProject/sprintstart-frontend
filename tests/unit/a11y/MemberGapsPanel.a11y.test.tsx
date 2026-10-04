import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemberGapsPanel } from "../../../src/features/team-management/components/detail/MemberGapsPanel";
import type { KnowledgeGap } from "../../../src/features/knowledge-gaps/types";
import type { UserSkillLevel } from "../../../src/services/teamManagementService";

const skill: UserSkillLevel = {
  id: "s1",
  skillId: "skill1",
  skillName: "Kotlin",
  roleName: "Backend",
  level: "ADVANCED",
};

function gap(overrides: Partial<KnowledgeGap>): KnowledgeGap {
  return {
    id: "g1",
    component: "auth-service",
    missingTypes: ["runbook", "adr"],
    lastIngested: "2026-09-01T09:00:00.000Z",
    refreshedAt: "2026-09-20T09:00:00.000Z",
    owners: [],
    severity: "high",
    ...overrides,
  };
}

describe("MemberGapsPanel Accessibility", () => {
  it("should not have any a11y violations with skills and gaps on the panel", async () => {
    // Mirrors the production composition: the panel is not a landmark itself — it renders inside
    // the "Member insights" landmark on TeamMemberDetailPage — so the region rule is satisfied by
    // the surrounding landmark, not by the panel.
    const { baseElement } = render(
      <aside aria-label="Member insights">
        <MemberGapsPanel
          skillLevels={[skill]}
          skillGaps={[skill]}
          knowledgeGaps={[
            gap({ id: "g1", severity: "high" }),
            gap({ id: "g2", component: "docs-wiki", severity: "low", missingTypes: ["adr"] }),
          ]}
          onOpenKnowledgeGap={vi.fn()}
        />
      </aside>,
    );

    expect(screen.getByText("auth-service")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("should not have any a11y violations on the empty panel", async () => {
    const { baseElement } = render(
      <aside aria-label="Member insights">
        <MemberGapsPanel
          skillLevels={[]}
          skillGaps={[]}
          knowledgeGaps={[]}
          onOpenKnowledgeGap={vi.fn()}
        />
      </aside>,
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
