import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemberGapsPanel } from "../../../../../../src/features/team-management/components/detail/MemberGapsPanel";
import type { KnowledgeGap } from "../../../../../../src/features/knowledge-gaps/types";

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

function renderPanel(knowledgeGaps: KnowledgeGap[], onOpenKnowledgeGap = vi.fn()) {
  render(
    <MemberGapsPanel
      skillLevels={[]}
      skillGaps={[]}
      knowledgeGaps={knowledgeGaps}
      onOpenKnowledgeGap={onOpenKnowledgeGap}
    />,
  );
  return { onOpenKnowledgeGap };
}

describe("MemberGapsPanel", () => {
  it("explains from the header what a knowledge gap is and how it is detected", () => {
    renderPanel([]);

    const trigger = screen.getByRole("button", { name: "What is a knowledge gap?" });
    const tooltip = screen.getByRole("tooltip");

    // The explainer stays reachable without hovering: the tooltip is in the accessibility tree
    // and wired to the trigger through aria-describedby.
    expect(trigger).toHaveAccessibleDescription(/missing material the project expects/);
    expect(tooltip).toHaveTextContent(
      "A knowledge gap is a component whose documentation is missing material the project expects — for example runbooks or ADRs.",
    );
    expect(tooltip).toHaveTextContent(
      "detected from the project's ingested documentation and refresh when new material is ingested.",
    );
  });

  it("reveals the explainer on keyboard focus and dismisses it on Escape", async () => {
    const user = userEvent.setup();
    renderPanel([]);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("opacity-0");

    await user.tab();
    expect(screen.getByRole("button", { name: "What is a knowledge gap?" })).toHaveFocus();
    expect(tooltip.className).toContain("opacity-100");

    await user.keyboard("{Escape}");
    expect(tooltip.className).toContain("opacity-0");
  });

  it("lists the member's gaps and hands the picked one to the caller", async () => {
    const user = userEvent.setup();
    const { onOpenKnowledgeGap } = renderPanel([
      gap({ id: "g1", component: "auth-service", severity: "high" }),
      gap({ id: "g2", component: "docs-wiki", severity: "low", missingTypes: ["adr"] }),
    ]);

    expect(screen.getByText("auth-service")).toBeInTheDocument();
    expect(screen.getByText("runbook, adr")).toBeInTheDocument();
    expect(screen.getByText("docs-wiki")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /auth-service/ }));
    expect(onOpenKnowledgeGap).toHaveBeenCalledWith("g1");
  });

  it("says so when the member has no gaps", () => {
    renderPanel([]);
    expect(screen.getByText("No knowledge gaps found.")).toBeInTheDocument();
  });
});
