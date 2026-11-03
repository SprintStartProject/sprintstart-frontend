import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { RoleManagementTab } from "../../../../../src/features/team-management/components/RoleManagementTab";

const mocks = vi.hoisted(() => ({
  permissionGroup: "PM",
  getSkills: vi.fn(),
  acceptSkillSuggestion: vi.fn(),
  createProjectRole: vi.fn(),
  deleteProjectRole: vi.fn(),
  assignProjectRoleToUser: vi.fn(),
  unassignProjectRoleFromUser: vi.fn(),
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProjectId: "project-1",
    selectedProject: { id: "project-1", industry: "Fintech" },
    hasSelectedProject: true,
  }),
}));

vi.mock("../../../../../src/services/teamManagementService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../src/services/teamManagementService")>();
  return {
    ...actual,
    getSkills: mocks.getSkills,
    acceptSkillSuggestion: mocks.acceptSkillSuggestion,
    createProjectRole: mocks.createProjectRole,
    deleteProjectRole: mocks.deleteProjectRole,
    assignProjectRoleToUser: mocks.assignProjectRoleToUser,
    unassignProjectRoleFromUser: mocks.unassignProjectRoleFromUser,
  };
});

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

const frontend = { id: "role-1", name: "Frontend", description: "Builds the UI" };
const backend = { id: "role-2", name: "Backend", description: "Owns the services" };
const design = { id: "role-3", name: "Design", description: "" };

function skill(id: string, name: string, roleIds: string[]) {
  return { id, name, roleIds, status: "ACTIVE" as const, category: "TECHNICAL", universal: false };
}

type Users = Parameters<typeof RoleManagementTab>[0]["users"];

function member(userId: string, firstname: string, lastname: string, roles: (typeof frontend)[]) {
  return {
    userId,
    firstname,
    lastname,
    projects: [],
    roles,
    skills: [],
    progressPercentage: 0.5,
    currentPhase: { id: "phase-1", title: "Setup" },
    currentStep: null,
    hasFeedback: false,
  } as unknown as Users[number];
}

const ada = member("u1", "Ada", "Lovelace", [frontend]);
const grace = member("u2", "Grace", "Hopper", []);
const linus = member("u3", "Linus", "Torvalds", [backend, frontend]);

const rowButton = (name: string) =>
  screen.getByRole("button", {
    name: new RegExp(`^(Manage skills and members of|Close) ${name}$`),
  });
const queryRowButton = (name: string) =>
  screen.queryByRole("button", {
    name: new RegExp(`^(Manage skills and members of|Close) ${name}$`),
  });

function rowOrder() {
  return screen
    .getAllByRole("button", { name: /^(Manage skills and members of|Close) / })
    .filter((button) => button.hasAttribute("aria-expanded"))
    .map((button) => button.textContent?.replace(/^(Manage skills and members of|Close) /, ""));
}

async function openRole(user: ReturnType<typeof userEvent.setup>, name = frontend.name) {
  await user.click(rowButton(name));
  await screen.findByText("Manage role");
}

describe("RoleManagementTab lists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissionGroup = "PM";
    mocks.getSkills.mockResolvedValue([
      skill("s1", "React", [frontend.id]),
      skill("s2", "SQL", [frontend.id, backend.id]),
      skill("s3", "Go", [backend.id]),
    ]);
    mocks.deleteProjectRole.mockResolvedValue(undefined);
    mocks.assignProjectRoleToUser.mockResolvedValue(undefined);
    mocks.unassignProjectRoleFromUser.mockResolvedValue(undefined);
  });

  describe("the toolbar", () => {
    const roles = [design, frontend, backend];

    it("lists the roles by name to begin with", async () => {
      render(<RoleManagementTab roles={roles} users={[ada, linus]} onDataChanged={vi.fn()} />);

      await waitFor(() => expect(rowOrder()).toEqual(["Backend", "Design", "Frontend"]));
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });

    it("sorts by the number of members and resets", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, linus]} onDataChanged={vi.fn()} />);

      await user.click(screen.getByRole("combobox", { name: "Sort roles" }));
      await user.click(screen.getByRole("option", { name: "Most members" }));

      expect(rowOrder()).toEqual(["Frontend", "Backend", "Design"]);

      await user.click(screen.getByRole("button", { name: "Reset" }));
      expect(rowOrder()).toEqual(["Backend", "Design", "Frontend"]);
    });

    it("sorts by the number of skills", async () => {
      const user = userEvent.setup();
      mocks.getSkills.mockResolvedValue([
        skill("s1", "React", [frontend.id]),
        skill("s2", "SQL", [frontend.id, backend.id]),
        skill("s4", "Vue", [frontend.id]),
      ]);
      render(<RoleManagementTab roles={roles} users={[]} onDataChanged={vi.fn()} />);
      await screen.findByText("Vue");

      await user.click(screen.getByRole("combobox", { name: "Sort roles" }));
      await user.click(screen.getByRole("option", { name: "Most skills" }));

      expect(rowOrder()).toEqual(["Frontend", "Backend", "Design"]);
    });

    it("narrows to roles without skills and lets go again", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada]} onDataChanged={vi.fn()} />);
      const chip = await screen.findByRole("button", { name: /No skills/ });

      await user.click(chip);
      expect(chip).toHaveAttribute("aria-pressed", "true");
      expect(rowOrder()).toEqual(["Design"]);
      expect(screen.getByText("1 of 3")).toBeInTheDocument();

      await user.click(chip);
      expect(chip).toHaveAttribute("aria-pressed", "false");
      expect(rowOrder()).toHaveLength(3);
    });

    it("counts the roles each gap would show", async () => {
      render(<RoleManagementTab roles={roles} users={[ada]} onDataChanged={vi.fn()} />);

      expect(await screen.findByRole("button", { name: /^No members\s*2$/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^No skills\s*1$/ })).toBeInTheDocument();
    });

    it("says so when no role matches", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada]} onDataChanged={vi.fn()} />);

      await user.type(screen.getByLabelText("Search roles"), "nothing like this");

      expect(screen.getByText("No roles match these filters.")).toBeInTheDocument();
    });

    it("keeps the open role in the list while the search excludes it", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada]} onDataChanged={vi.fn()} />);
      await openRole(user);

      await user.type(screen.getByLabelText("Search roles"), "backend");

      expect(rowButton("Frontend")).toBeInTheDocument();
      expect(rowButton("Backend")).toBeInTheDocument();
      expect(queryRowButton("Design")).not.toBeInTheDocument();
    });

    it("invites to create the first role when there is none", () => {
      render(<RoleManagementTab roles={[]} users={[]} onDataChanged={vi.fn()} />);

      expect(screen.getByText(/No roles yet\. Create the first one/)).toBeInTheDocument();
    });
  });

  describe("the members of the open role", () => {
    const roles = [frontend, backend];

    it("starts with the holders ticked and nothing to save", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[grace, ada]} onDataChanged={vi.fn()} />);
      await openRole(user);

      expect(screen.getByRole("checkbox", { name: /Ada Lovelace/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Grace Hopper/ })).not.toBeChecked();
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
      const boxes = screen.getAllByRole("checkbox");
      expect(boxes[0]).toBe(screen.getByRole("checkbox", { name: /Ada Lovelace/ }));
    });

    it("tells what saving will add and what it will remove", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={vi.fn()} />);
      await openRole(user);

      await user.click(screen.getByRole("checkbox", { name: /Grace Hopper/ }));
      expect(screen.getByText("Will be added")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save 1 change" })).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: /Ada Lovelace/ }));
      expect(screen.getByText("Will be removed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save 2 changes" })).toBeInTheDocument();
    });

    it("takes the ticks back with Reset", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={vi.fn()} />);
      await openRole(user);
      await user.click(screen.getByRole("checkbox", { name: /Grace Hopper/ }));

      await user.click(screen.getByRole("button", { name: "Reset" }));

      expect(screen.getByRole("checkbox", { name: /Grace Hopper/ })).not.toBeChecked();
      expect(screen.queryByText("Will be added")).not.toBeInTheDocument();
    });

    it("sends only the difference and reads the data back", async () => {
      const onDataChanged = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(
        <RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={onDataChanged} />,
      );
      await openRole(user);
      await user.click(screen.getByRole("checkbox", { name: /Grace Hopper/ }));
      await user.click(screen.getByRole("checkbox", { name: /Ada Lovelace/ }));

      await user.click(screen.getByRole("button", { name: "Save 2 changes" }));

      expect(await screen.findByText("Members updated")).toBeInTheDocument();
      expect(mocks.assignProjectRoleToUser).toHaveBeenCalledExactlyOnceWith("u2", "role-1");
      expect(mocks.unassignProjectRoleFromUser).toHaveBeenCalledExactlyOnceWith("u1", "role-1");
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });

    it("names every member that could not be updated when all of them fail", async () => {
      mocks.assignProjectRoleToUser.mockRejectedValue(new Error("Nope"));
      const onDataChanged = vi.fn();
      const user = userEvent.setup();
      render(
        <RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={onDataChanged} />,
      );
      await openRole(user);
      await user.click(screen.getByRole("checkbox", { name: /Grace Hopper/ }));

      await user.click(screen.getByRole("button", { name: "Save 1 change" }));

      expect(await screen.findByText("Couldn't update Grace Hopper")).toBeInTheDocument();
      expect(screen.queryByText(/The other changes were saved/)).not.toBeInTheDocument();
      expect(onDataChanged).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Save 1 change" })).toBeInTheDocument();
    });

    it("searches the people by name", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={vi.fn()} />);
      await openRole(user);

      await user.type(screen.getByLabelText("Search members"), "hopp");

      expect(screen.queryByRole("checkbox", { name: /Ada Lovelace/ })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Grace Hopper/ })).toBeInTheDocument();
    });

    it("says when nobody matches, and when there is nobody", async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <RoleManagementTab roles={roles} users={[ada]} onDataChanged={vi.fn()} />,
      );
      await openRole(user);
      await user.type(screen.getByLabelText("Search members"), "zzz");
      expect(screen.getByText("Nobody matches.")).toBeInTheDocument();
      unmount();

      render(<RoleManagementTab roles={roles} users={[]} onDataChanged={vi.fn()} />);
      await openRole(user);
      expect(screen.getByText("No members in this project yet.")).toBeInTheDocument();
      expect(screen.queryByText("Nobody matches.")).not.toBeInTheDocument();
    });

    it("narrows to the holders, and lets go again", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={vi.fn()} />);
      await openRole(user);
      const chip = screen.getByRole("button", { name: /^Has this role/ });

      await user.click(chip);
      expect(screen.queryByRole("checkbox", { name: /Grace Hopper/ })).not.toBeInTheDocument();

      await user.click(chip);
      expect(screen.getByRole("checkbox", { name: /Grace Hopper/ })).toBeInTheDocument();
    });

    it("shows the members without a role from the hint above the list", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={vi.fn()} />);
      expect(screen.getByText("Open a role to give it to them.")).toBeInTheDocument();
      await openRole(user);

      await user.click(screen.getByRole("button", { name: "Show them in Frontend" }));

      expect(screen.queryByRole("checkbox", { name: /Ada Lovelace/ })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Grace Hopper/ })).toBeInTheDocument();
    });

    it("names a few of the members without a role and counts the rest", () => {
      const lonely = ["Anna A", "Bert B", "Cleo C", "Dora D"].map((name, index) =>
        member(`x${index}`, name.split(" ")[0], name.split(" ")[1], []),
      );
      render(<RoleManagementTab roles={roles} users={lonely} onDataChanged={vi.fn()} />);

      expect(screen.getByText("4 without a role:")).toBeInTheDocument();
      expect(screen.getByText("Anna A, Bert B, Cleo C +1")).toBeInTheDocument();
    });

    it("shows how far each person is, and that nobody has a role yet", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, grace]} onDataChanged={vi.fn()} />);
      await openRole(user);

      expect(screen.getAllByText("50% through")).toHaveLength(2);
      expect(screen.getAllByText("Setup")).toHaveLength(2);
      expect(screen.getByText("No roles")).toBeInTheDocument();
    });

    it("closes with the cross, and again from the row", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada]} onDataChanged={vi.fn()} />);
      await openRole(user);

      await user.click(screen.getByRole("button", { name: "Close role details" }));
      await waitFor(() => expect(screen.queryByText("Manage role")).not.toBeInTheDocument());

      await openRole(user);
      await user.click(rowButton("Frontend"));
      await waitFor(() => expect(screen.queryByText("Manage role")).not.toBeInTheDocument());
    });

    it("starts afresh with another role", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={roles} users={[ada, linus]} onDataChanged={vi.fn()} />);
      await openRole(user);
      await user.type(screen.getByLabelText("Search members"), "ada");

      await user.click(rowButton("Backend"));

      await waitFor(() => expect(screen.getByLabelText("Search members")).toHaveValue(""));
      expect(screen.getByRole("checkbox", { name: /Linus Torvalds/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Ada Lovelace/ })).not.toBeChecked();
    });
  });

  describe("the skills of the open role", () => {
    it("adds a skill by name", async () => {
      mocks.acceptSkillSuggestion.mockResolvedValue([skill("s9", "Vue", ["role-1"])]);
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[ada]} onDataChanged={vi.fn()} />);
      await openRole(user);
      const add = screen.getByRole("button", { name: "Add skill" });
      expect(add).toBeDisabled();

      await user.type(screen.getByLabelText("Add skill to Frontend"), "  Vue ");
      await user.click(add);

      expect(await screen.findByText("Skill added")).toBeInTheDocument();
      expect(mocks.acceptSkillSuggestion).toHaveBeenCalledExactlyOnceWith("role-1", {
        name: "Vue",
      });
      expect(screen.getByLabelText("Add skill to Frontend")).toHaveValue("");
      expect(screen.getByLabelText("Vue")).toBeInTheDocument();
    });

    it("keeps what was typed when adding fails", async () => {
      mocks.acceptSkillSuggestion.mockRejectedValue(new Error("Nope"));
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[ada]} onDataChanged={vi.fn()} />);
      await openRole(user);

      await user.type(screen.getByLabelText("Add skill to Frontend"), "Vue");
      await user.click(screen.getByRole("button", { name: "Add skill" }));

      expect(await screen.findByText(/Nope/)).toBeInTheDocument();
      expect(screen.getByLabelText("Add skill to Frontend")).toHaveValue("Vue");
    });

    it("says so when the role has no skills", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[design]} users={[]} onDataChanged={vi.fn()} />);
      await openRole(user, "Design");

      expect(screen.getByText("No skills added yet.")).toBeInTheDocument();
    });
  });

  describe("creating a role", () => {
    it("opens and closes the form from the toolbar and focuses the name", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[]} onDataChanged={vi.fn()} />);
      const toggle = screen.getByRole("button", { name: "New role" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toHaveTextContent("Cancel");
      expect(screen.getByLabelText("Name")).toHaveFocus();

      await user.click(toggle);
      await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
    });

    it("needs a name before it can create", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[]} onDataChanged={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "New role" }));
      const create = screen.getByRole("button", { name: "Create role" });
      expect(create).toBeDisabled();

      await user.type(screen.getByLabelText("Name"), "   ");
      expect(create).toBeDisabled();

      await user.type(screen.getByLabelText("Name"), "QA");
      expect(create).toBeEnabled();
    });

    it("creates the role from the trimmed fields and opens it", async () => {
      mocks.permissionGroup = "HR";
      mocks.createProjectRole.mockResolvedValue({ id: "role-9", name: "QA", description: "Tests" });
      const onDataChanged = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(
        <RoleManagementTab
          roles={[frontend, { id: "role-9", name: "QA", description: "Tests" }]}
          users={[]}
          onDataChanged={onDataChanged}
        />,
      );
      await user.click(screen.getByRole("button", { name: "New role" }));
      expect(screen.getByText("The role opens right away to assign members.")).toBeInTheDocument();
      expect(screen.queryByLabelText(/Also suggest skills/)).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Name"), "  QA ");
      await user.type(screen.getByLabelText("Description"), " Tests ");
      await user.click(screen.getByRole("button", { name: "Create role" }));

      expect(await screen.findByText("Role created")).toBeInTheDocument();
      expect(mocks.createProjectRole).toHaveBeenCalledExactlyOnceWith("QA", "Tests");
      expect(onDataChanged).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("Manage role")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
    });

    it("keeps the form and says why when creating fails", async () => {
      mocks.createProjectRole.mockRejectedValue(new Error("Duplicate"));
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[]} onDataChanged={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "New role" }));
      await user.type(screen.getByLabelText("Name"), "QA");

      await user.click(screen.getByRole("button", { name: "Create role" }));

      expect(await screen.findByText(/Duplicate/)).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("QA");
      expect(screen.getByRole("button", { name: "Create role" })).toBeEnabled();
    });
  });

  describe("deleting a role", () => {
    it("says what stays and what goes, then deletes on confirmation", async () => {
      const onDataChanged = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(
        <RoleManagementTab
          roles={[frontend, backend]}
          users={[ada, linus]}
          onDataChanged={onDataChanged}
        />,
      );
      await screen.findAllByText("SQL");

      await user.click(screen.getByRole("button", { name: "Delete Frontend" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent(/Are you sure you want to delete Frontend\?/);
      expect(
        within(dialog).getByText(/2 members lose this role: Ada Lovelace, Linus Torvalds\./),
      ).toBeInTheDocument();
      expect(within(dialog).getByText(/Its 2 skills stay in the catalog/)).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText("Role deleted")).toBeInTheDocument();
      expect(mocks.deleteProjectRole).toHaveBeenCalledExactlyOnceWith("role-1");
      expect(onDataChanged).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("says it in the singular for one member and one skill", async () => {
      mocks.getSkills.mockResolvedValue([skill("s1", "React", ["role-1"])]);
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[ada]} onDataChanged={vi.fn()} />);
      await screen.findByText("React");

      await user.click(screen.getByRole("button", { name: "Delete Frontend" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(
        within(dialog).getByText(/1 member loses this role: Ada Lovelace\./),
      ).toBeInTheDocument();
      expect(within(dialog).getByText(/Its 1 skill stays/)).toBeInTheDocument();
    });

    it("leaves the role alone when cancelled", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[design]} users={[]} onDataChanged={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Delete Design" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).queryByText(/members? lose/)).not.toBeInTheDocument();
      expect(within(dialog).queryByText(/skills? stay/)).not.toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(mocks.deleteProjectRole).not.toHaveBeenCalled();
    });

    it("closes the panel of the role that was deleted", async () => {
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[ada]} onDataChanged={vi.fn()} />);
      await openRole(user);

      await user.click(screen.getByRole("button", { name: "Delete Frontend" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(screen.queryByText("Manage role")).not.toBeInTheDocument());
    });

    it("says so and keeps the panel when deleting fails", async () => {
      mocks.deleteProjectRole.mockRejectedValue(new Error("Nope"));
      const onDataChanged = vi.fn();
      const user = userEvent.setup();
      render(<RoleManagementTab roles={[frontend]} users={[ada]} onDataChanged={onDataChanged} />);
      await openRole(user);

      await user.click(screen.getByRole("button", { name: "Delete Frontend" }));
      const dialog = await screen.findByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      expect(await screen.findByText(/Nope/)).toBeInTheDocument();
      expect(screen.getByText("Manage role")).toBeInTheDocument();
      expect(onDataChanged).not.toHaveBeenCalled();
    });
  });
});
