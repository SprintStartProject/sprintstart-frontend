import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { RoleManagementTab } from "../../../../../src/features/team-management/components/RoleManagementTab";

const mocks = vi.hoisted(() => ({
  permissionGroup: "PM",
  selectedProjectId: "project-1",
  getSkills: vi.fn(),
  getSkillsByRoleId: vi.fn(),
  suggestSkillsForRole: vi.fn(),
  acceptSkillSuggestion: vi.fn(),
  createProjectRole: vi.fn(),
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProjectId: mocks.selectedProjectId,
    selectedProject: mocks.selectedProjectId
      ? { id: mocks.selectedProjectId, industry: "Fintech" }
      : null,
    hasSelectedProject: Boolean(mocks.selectedProjectId),
  }),
}));

vi.mock("../../../../../src/services/teamManagementService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../src/services/teamManagementService")>();
  return {
    ...actual,
    getSkills: mocks.getSkills,
    getSkillsByRoleId: mocks.getSkillsByRoleId,
    suggestSkillsForRole: mocks.suggestSkillsForRole,
    acceptSkillSuggestion: mocks.acceptSkillSuggestion,
    createProjectRole: mocks.createProjectRole,
  };
});

const role = { id: "role-1", name: "Frontend", description: "Builds the UI" };
const existingSkill = {
  id: "skill-1",
  name: "TypeScript",
  roleIds: [role.id],
  status: "ACTIVE" as const,
  category: "TECHNICAL",
  universal: false,
};
const acceptedSkill = {
  id: "skill-2",
  name: "React",
  roleIds: [role.id],
  status: "ACTIVE" as const,
  category: "TECHNICAL",
  universal: false,
};
const suggestion = {
  skillId: "skill-2",
  name: "React",
  category: "TECHNICAL",
  reason: "The role builds the project UI",
  confidence: "high",
  isNew: false,
  chunkIds: ["chunk-1"],
};

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

async function openRole(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: `Manage skills and members of ${role.name}` }),
  );
  await screen.findByText("Manage role");
}

describe("RoleManagementTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissionGroup = "PM";
    mocks.selectedProjectId = "project-1";
    mocks.getSkills.mockResolvedValue([existingSkill]);
    mocks.getSkillsByRoleId.mockResolvedValue([existingSkill]);
    mocks.suggestSkillsForRole.mockResolvedValue([suggestion]);
    mocks.acceptSkillSuggestion.mockResolvedValue([existingSkill, acceptedSkill]);
    mocks.createProjectRole.mockResolvedValue(role);
  });

  it("does not show the suggestion button for HR", async () => {
    mocks.permissionGroup = "HR";
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await openRole(user);

    expect(screen.queryByTestId("suggest-skills-button")).not.toBeInTheDocument();
  });

  it("loads project-scoped suggestions into a preselected review panel", async () => {
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    await openRole(user);
    await user.click(screen.getByTestId("suggest-skills-button"));

    expect(await screen.findByTestId("skill-suggestion-panel")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Accept React" })).toBeChecked();
    expect(screen.getByText("The role builds the project UI")).toBeInTheDocument();
    expect(screen.getAllByText("TypeScript")).toHaveLength(2);
    expect(mocks.suggestSkillsForRole).toHaveBeenCalledWith(role.id, {
      projectId: "project-1",
      industry: "Fintech",
    });
    expect(mocks.acceptSkillSuggestion).not.toHaveBeenCalled();
  });

  it("only persists suggestions that remain selected", async () => {
    const secondSuggestion = {
      skillId: null,
      name: "Storybook",
      category: "TOOLING",
      reason: "Supports component development",
      confidence: "medium",
      isNew: true,
      chunkIds: [],
    };
    mocks.suggestSkillsForRole.mockResolvedValue([suggestion, secondSuggestion]);
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    await openRole(user);
    await user.click(screen.getByTestId("suggest-skills-button"));
    await user.click(await screen.findByRole("checkbox", { name: "Accept Storybook" }));
    await user.click(screen.getByRole("button", { name: "Apply 1 suggestion" }));

    await waitFor(() =>
      expect(mocks.acceptSkillSuggestion).toHaveBeenCalledWith(role.id, {
        skillId: "skill-2",
      }),
    );
    expect(mocks.acceptSkillSuggestion).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("skill-suggestion-panel")).not.toBeInTheDocument();
  });

  it("shows an AI outage in the panel without changing role skills", async () => {
    mocks.suggestSkillsForRole.mockRejectedValue(
      Object.assign(new Error("AI unavailable"), { status: 502 }),
    );
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await openRole(user);
    await user.click(screen.getByTestId("suggest-skills-button"));

    expect(await screen.findByText("Suggestions could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(mocks.acceptSkillSuggestion).not.toHaveBeenCalled();
  });

  it("creates a role first and then requests project-scoped suggestions", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);
    render(<RoleManagementTab roles={[]} users={[]} onDataChanged={onDataChanged} />);

    await user.type(screen.getByLabelText("Name"), "Frontend");
    await user.type(screen.getByLabelText("Description"), "Builds the UI");
    await user.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() =>
      expect(mocks.createProjectRole).toHaveBeenCalledWith("Frontend", "Builds the UI"),
    );
    await waitFor(() =>
      expect(mocks.suggestSkillsForRole).toHaveBeenCalledWith(role.id, {
        projectId: "project-1",
        industry: "Fintech",
      }),
    );
  });
});
