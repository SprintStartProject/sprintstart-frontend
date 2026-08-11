import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { SkillWizardPage } from "../../../src/pages/SkillWizardPage";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "user1", firstName: "Test", lastName: "User" } }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../../src/services/teamManagementService", () => ({
  getMyTeamOverview: vi.fn().mockResolvedValue({
    userId: "user1",
    firstname: "Alice",
    lastname: "Smith",
    roles: [],
    skills: [],
    progressPercentage: 0,
    currentPhase: { id: "p1", title: "Phase 1" },
    currentStep: null,
    hasFeedback: false,
    projects: [{ id: "proj1", name: "Project 1" }],
  }),
  getSkills: vi
    .fn()
    .mockResolvedValue([
      { id: "skill1", name: "TypeScript", roleIds: ["role1"], status: "ACTIVE" },
    ]),
  getSkillAssessmentPromptState: vi.fn().mockReturnValue(null),
  markSkillAssessmentPromptDismissed: vi.fn(),
  markSkillAssessmentPromptCompleted: vi.fn(),
  saveUserSkillAssessments: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/features/team-management/components/SkillWizard", () => ({
  SkillWizard: () => <div data-testid="skill-wizard">Skill Wizard</div>,
}));

describe("SkillWizardPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <SkillWizardPage />
        </main>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("skill-wizard")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
