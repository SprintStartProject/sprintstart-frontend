import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillWizard } from "../../../../../src/features/team-management/components/SkillWizard";
import type { Skill, TeamOverviewUser } from "../../../../../src/features/team-management/types";

function createUser(overrides: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "u1",
    firstname: "Jane",
    lastname: "Doe",
    roles: [{ id: "r1", name: "Backend", description: "" }],
    skills: [],
    progressPercentage: 0.5,
    currentPhase: { id: "p1", title: "Phase 1" },
    currentStep: null,
    hasFeedback: false,
    projects: [{ id: "proj1", name: "Project 1" }],
    ...overrides,
  };
}

const mockSkills: Skill[] = [
  { id: "sk1", name: "TypeScript", roleIds: ["r1"], status: "ACTIVE" },
  { id: "sk2", name: "Docker", roleIds: ["r1"], status: "ACTIVE" },
  { id: "sk3", name: "Unrelated", roleIds: ["r2"], status: "ACTIVE" },
  { id: "sk4", name: "Retired", roleIds: ["r1"], status: "RETIRED" },
];

describe("SkillWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal title and skill cards for role-linked skills", () => {
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Skill Self Assessment")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
  });

  it("filters out skills not linked to the user roles", () => {
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByText("Unrelated")).not.toBeInTheDocument();
  });

  it("filters out retired skills", () => {
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByText("Retired")).not.toBeInTheDocument();
  });

  it("disables the save button until all skills are rated", () => {
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save Assessment" });
    expect(saveButton).toBeDisabled();
  });

  it("enables the save button after all skills are rated", async () => {
    const user = userEvent.setup();
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const beginnerButtons = screen.getAllByRole("button", { name: "Beginner" });
    await user.click(beginnerButtons[0]);
    await user.click(beginnerButtons[1]);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Assessment" })).toBeEnabled(),
    );
  });

  it("calls onSubmit with the assessment payload when save is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    const intermediateButtons = screen.getAllByRole("button", { name: "Intermediate" });
    await user.click(intermediateButtons[0]);
    await user.click(intermediateButtons[1]);

    await user.click(screen.getByRole("button", { name: "Save Assessment" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith([
        { userId: "u1", skillId: "sk1", level: "INTERMEDIATE" },
        { userId: "u1", skillId: "sk2", level: "INTERMEDIATE" },
      ]),
    );
  });

  it('shows "No skills found" message when no skills match the roles', () => {
    render(
      <SkillWizard
        open={true}
        user={createUser({ roles: [] })}
        skills={mockSkills}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("No skills found for your assigned roles.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it('calls onClose when the "Later" button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SkillWizard
        open={true}
        user={createUser()}
        skills={mockSkills}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(onClose).toHaveBeenCalled();
  });
});
