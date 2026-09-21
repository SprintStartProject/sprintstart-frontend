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
  updateRoleSkills: vi.fn(),
  createProjectRole: vi.fn(),
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProjectId: mocks.selectedProjectId,
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
    updateRoleSkills: mocks.updateRoleSkills,
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
const aiSkill = {
  id: "skill-2",
  name: "React",
  roleIds: [role.id, "role-2"],
  status: "ACTIVE" as const,
  category: "TECHNICAL",
  universal: false,
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
    mocks.getSkillsByRoleId.mockResolvedValue([]);
    mocks.updateRoleSkills.mockResolvedValue([existingSkill]);
    mocks.createProjectRole.mockResolvedValue(role);
  });

  it("does not show the suggestion button for HR", async () => {
    mocks.permissionGroup = "HR";
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await openRole(user);

    expect(screen.queryByTestId("suggest-skills-button")).not.toBeInTheDocument();
  });

  it("requests suggestions and marks only newly added chips as AI-generated", async () => {
    mocks.suggestSkillsForRole.mockResolvedValue([existingSkill, aiSkill]);
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    await openRole(user);
    await user.click(screen.getByTestId("suggest-skills-button"));

    expect(await screen.findByLabelText("React, AI suggested")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByLabelText("TypeScript")).toBeInTheDocument();
    expect(mocks.suggestSkillsForRole).toHaveBeenCalledWith(role.id);
  });

  it("discards AI additions by restoring the pre-suggestion skill IDs", async () => {
    mocks.suggestSkillsForRole.mockResolvedValue([existingSkill, aiSkill]);
    const user = userEvent.setup();
    render(<RoleManagementTab roles={[role]} users={[]} onDataChanged={vi.fn()} />);

    await waitFor(() => expect(mocks.getSkills).toHaveBeenCalled());
    await openRole(user);
    await user.click(screen.getByTestId("suggest-skills-button"));
    await user.click(await screen.findByRole("button", { name: "Discard AI additions" }));

    await waitFor(() =>
      expect(mocks.updateRoleSkills).toHaveBeenCalledWith(role.id, [existingSkill.id]),
    );
  });

  it("creates a role with the selected project and reloads its generated skills", async () => {
    const user = userEvent.setup();
    const onDataChanged = vi.fn().mockResolvedValue(undefined);
    mocks.getSkillsByRoleId.mockResolvedValue([aiSkill]);
    render(<RoleManagementTab roles={[]} users={[]} onDataChanged={onDataChanged} />);

    await user.type(screen.getByLabelText("Name"), "Frontend");
    await user.type(screen.getByLabelText("Description"), "Builds the UI");
    await user.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() =>
      expect(mocks.createProjectRole).toHaveBeenCalledWith("Frontend", "Builds the UI", {
        projectId: "project-1",
      }),
    );
    await waitFor(() => expect(mocks.getSkillsByRoleId).toHaveBeenCalledWith(role.id));
  });
});
