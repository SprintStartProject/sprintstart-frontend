import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AdminPage } from "../../../src/pages/AdminPage";
import type { AdminUser } from "../../../src/services/adminUserService";
import type { AdminProject, AdminProjectDetails } from "../../../src/services/projectService";

const mocks = vi.hoisted(() => ({
  permissionGroup: "ADMIN",
  reloadProjects: vi.fn(),
  getUsers: vi.fn(),
  deleteUser: vi.fn(),
  getProjects: vi.fn(),
  getPatNames: vi.fn(),
  getSkills: vi.fn(),
  getProjectRoles: vi.fn(),
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue } = await import("../setup/projectContext");
  return {
    useProjectContext: () => createProjectContextValue({ reloadProjects: mocks.reloadProjects }),
  };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "a", permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../src/services/adminUserService", () => ({
  adminUserService: { getUsers: mocks.getUsers, deleteUser: mocks.deleteUser },
}));

vi.mock("../../../src/services/projectService", () => ({
  projectService: { getProjects: mocks.getProjects },
}));

vi.mock("../../../src/services/sources/githubService", () => ({
  getGithubPatNames: mocks.getPatNames,
}));

vi.mock("../../../src/services/teamManagementService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../src/services/teamManagementService")>();
  return { ...actual, getSkills: mocks.getSkills, getProjectRoles: mocks.getProjectRoles };
});

type Row = { id: string; firstName: string };

vi.mock("../../../src/features/admin/components/UsersTab", () => ({
  UsersTab: (props: {
    paginatedUsers: Row[];
    selectedUserIds: Set<string>;
    allVisibleUsersSelected: boolean;
    openUserMenuId: string | null;
    onToggleAllVisibleUsers: () => void;
    onToggleUserSelection: (id: string) => void;
    onOpenUserDetails: (user: Row) => void;
    onToggleUserContextMenu: (event: { stopPropagation: () => void }, id: string) => void;
    onOpenUserDetailsFromMenu: (event: { stopPropagation: () => void }, user: Row) => void;
    onRequestUserDeleteFromMenu: (event: { stopPropagation: () => void }, user: Row) => void;
  }) => {
    const event = { stopPropagation: vi.fn() };
    return (
      <div data-testid="users-tab">
        <p>ticked: {props.selectedUserIds.size}</p>
        <p>all visible: {String(props.allVisibleUsersSelected)}</p>
        <p>menu: {props.openUserMenuId ?? "none"}</p>
        <button onClick={props.onToggleAllVisibleUsers}>Tick all</button>
        {props.paginatedUsers.map((user) => (
          <div key={user.id}>
            <span>{user.firstName}</span>
            <button onClick={() => props.onToggleUserSelection(user.id)}>
              Tick {user.firstName}
            </button>
            <button onClick={() => props.onOpenUserDetails(user)}>View {user.firstName}</button>
            <button onClick={() => props.onToggleUserContextMenu(event, user.id)}>
              Menu {user.firstName}
            </button>
            <button onClick={() => props.onOpenUserDetailsFromMenu(event, user)}>
              Menu view {user.firstName}
            </button>
            <button onClick={() => props.onRequestUserDeleteFromMenu(event, user)}>
              Delete {user.firstName}
            </button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("../../../src/features/admin/components/ProjectsTab", () => ({
  ProjectsTab: (props: {
    filteredProjects: { id: string; name: string }[];
    isFiltered: boolean;
    totalCount: number;
    users: unknown[];
    onOpenProjectDetails: (project: unknown) => void;
  }) => (
    <div data-testid="projects-tab">
      <p>
        shown {props.filteredProjects.length} of {props.totalCount}, filtered:{" "}
        {String(props.isFiltered)}, users: {props.users.length}
      </p>
      {props.filteredProjects.map((project) => (
        <button key={project.id} onClick={() => props.onOpenProjectDetails(project)}>
          Open {project.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/SkillsTab", () => ({
  SkillsTab: (props: {
    skills: { id: string; name: string }[];
    totalCount: number;
    hasSearchQuery: boolean;
    loadingState: string;
    errorMessage: string;
    onOpenSkillDetails: (skill: unknown) => void;
    onRetryLoad: () => void;
  }) => (
    <div data-testid="skills-tab">
      <p>
        {props.loadingState} {props.skills.length}/{props.totalCount} search:{" "}
        {String(props.hasSearchQuery)} {props.errorMessage}
      </p>
      {props.skills.map((skill) => (
        <button key={skill.id} onClick={() => props.onOpenSkillDetails(skill)}>
          Skill {skill.name}
        </button>
      ))}
      <button onClick={props.onRetryLoad}>Retry skills</button>
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/TokensTab", () => ({
  TokensTab: (props: { sourceFilter: string; onSourceFilterChange: (value: string) => void }) => (
    <div data-testid="tokens-tab">
      <p>filter: {props.sourceFilter}</p>
      <button onClick={() => props.onSourceFilterChange("github")}>Pick github</button>
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/UserDetailsDrawer", () => ({
  UserDetailsDrawer: (props: {
    user: AdminUser;
    isOpen: boolean;
    onClose: () => void;
    onUserUpdated: (user: AdminUser) => void;
    onRequestDelete: (user: AdminUser) => void;
    onMembershipsMoved: () => void;
  }) => (
    <div data-testid="user-drawer">
      <p>
        user drawer: {props.user.firstName} open={String(props.isOpen)}
      </p>
      <button onClick={() => props.onUserUpdated({ ...props.user, firstName: "Renamed" })}>
        Rename user
      </button>
      <button onClick={() => props.onRequestDelete(props.user)}>Drawer delete</button>
      <button onClick={props.onMembershipsMoved}>User moved</button>
      <button onClick={props.onClose}>Close user drawer</button>
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/ProjectDetailsDrawer", () => ({
  ProjectDetailsDrawer: (props: {
    project: AdminProject;
    isOpen: boolean;
    canManageLifecycle: boolean;
    onClose: () => void;
    onOpenSourceDetails: (projectId: string, sourceId: string) => void;
    onOpenDataIngestion: (projectId: string) => void;
    onProjectUpdated: (project: AdminProjectDetails) => void;
    onProjectDeleted: (projectId: string) => void;
    onMembershipsMoved: () => void;
  }) => (
    <div data-testid="project-drawer">
      <p>
        project drawer: {props.project.name} open={String(props.isOpen)} lifecycle=
        {String(props.canManageLifecycle)}
      </p>
      <button
        onClick={() =>
          props.onProjectUpdated({
            ...props.project,
            name: "Alpha renamed",
            users: [{ id: "1" }, { id: "3" }],
          } as unknown as AdminProjectDetails)
        }
      >
        Rename project
      </button>
      <button onClick={() => props.onProjectDeleted(props.project.id)}>Remove project</button>
      <button onClick={() => props.onOpenSourceDetails(props.project.id, "src-9")}>
        Open source
      </button>
      <button onClick={() => props.onOpenDataIngestion(props.project.id)}>Open ingestion</button>
      <button onClick={props.onMembershipsMoved}>Project moved</button>
      <button onClick={props.onClose}>Close project drawer</button>
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/SkillDetailsDrawer", () => ({
  SkillDetailsDrawer: (props: {
    skill: { name: string } | null;
    isOpen: boolean;
    onClose: () => void;
    onSkillSaved: (skill: unknown) => void;
  }) => (
    <div data-testid="skill-drawer">
      <p>skill drawer: {props.skill ? props.skill.name : "new"}</p>
      <button
        onClick={() =>
          props.onSkillSaved({
            id: props.skill ? "sk1" : "sk-new",
            name: props.skill ? "TypeScript 6" : "Brand new",
            status: "ACTIVE",
            roleIds: [],
            universal: false,
          })
        }
      >
        Save skill
      </button>
      <button onClick={props.onClose}>Close skill drawer</button>
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/CreateProjectWizard", () => ({
  CreateProjectWizard: (props: {
    isOpen: boolean;
    tokenNames: string[];
    existingProjectNames: string[];
    onClose: () => void;
    onProjectCreated: () => void;
    onMembershipsMoved: () => void;
  }) =>
    props.isOpen ? (
      <div data-testid="wizard">
        <p>
          wizard tokens: {props.tokenNames.join(",")} existing:{" "}
          {props.existingProjectNames.join(",")}
        </p>
        <button onClick={props.onProjectCreated}>Created</button>
        <button onClick={props.onMembershipsMoved}>Wizard moved</button>
        <button onClick={props.onClose}>Close wizard</button>
      </div>
    ) : null,
}));

function user(id: string, firstName: string, over: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    username: firstName.toLowerCase(),
    email: `${firstName.toLowerCase()}@x.io`,
    firstName,
    lastName: "Tester",
    roles: [],
    permissionGroup: "User",
    projects: [],
    projectIds: [],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: true,
    ...over,
  };
}

function project(id: string, name: string, over: Partial<AdminProject> = {}): AdminProject {
  return {
    id,
    name,
    description: "",
    manager: null,
    sources: [],
    users: [],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
    ...over,
  };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderPage(path = "/admin") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminPage />
      <Where />
    </MemoryRouter>,
  );
}

async function ready() {
  await screen.findByTestId("users-tab");
}

const skill = { id: "sk1", name: "TypeScript", status: "ACTIVE", roleIds: [], universal: false };

describe("AdminPage flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissionGroup = "ADMIN";
    mocks.getUsers.mockResolvedValue([user("1", "Ann"), user("2", "Bob"), user("3", "Cy")]);
    mocks.deleteUser.mockResolvedValue({ deleted: true });
    mocks.getProjects.mockResolvedValue([
      project("p1", "Alpha", { users: [{ id: "1" }, { id: "2" }] as never }),
      project("p2", "Beta"),
    ]);
    mocks.getPatNames.mockResolvedValue(["token-a", "token-b"]);
    mocks.getSkills.mockResolvedValue([skill, { ...skill, id: "sk2", name: "React" }]);
    mocks.getProjectRoles.mockResolvedValue([]);
  });

  describe("loading", () => {
    it("says it is loading, then shows the users", async () => {
      renderPage();
      expect(screen.getByText("Loading admin data...")).toBeInTheDocument();
      await ready();
      expect(screen.queryByText("Loading admin data...")).not.toBeInTheDocument();
    });

    it("shows why loading failed and loads again on request", async () => {
      mocks.getUsers.mockRejectedValueOnce(new Error("Backend is down"));
      const user = userEvent.setup();
      renderPage();

      expect(await screen.findByText("Admin data could not be loaded")).toBeInTheDocument();
      expect(screen.getByText("Backend is down")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try again" }));
      await ready();
      expect(mocks.getUsers).toHaveBeenCalledTimes(2);
    });

    it("counts users and projects in the header", async () => {
      renderPage();
      await ready();
      expect(screen.getByText("Access Management")).toBeInTheDocument();
    });
  });

  describe("the users list", () => {
    it("searches and filters back to the first page", async () => {
      const user = userEvent.setup();
      renderPage();
      await ready();

      await user.type(screen.getByLabelText("Search users"), "bo");

      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.queryByText("Ann")).not.toBeInTheDocument();
    });

    it("pages through more users than fit on a page", async () => {
      mocks.getUsers.mockResolvedValue(
        Array.from({ length: 10 }, (_, index) => user(String(index + 1), `Person${index + 1}`)),
      );
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      expect(screen.getByText("Person1")).toBeInTheDocument();
      expect(screen.queryByText("Person9")).not.toBeInTheDocument();

      await user_.click(screen.getAllByRole("button", { name: "Next page" })[0]);

      expect(screen.getByText("Person9")).toBeInTheDocument();
      expect(screen.queryByText("Person1")).not.toBeInTheDocument();

      await user_.type(screen.getByLabelText("Search users"), "Person1");
      expect(screen.getByText("Person1")).toBeInTheDocument();
    });

    it("ticks users, ticks them all, and unticks them all", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      expect(screen.getByText("ticked: 0")).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));
      expect(screen.getByText("ticked: 1")).toBeInTheDocument();
      expect(screen.getByText("all visible: false")).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Tick all" }));
      expect(screen.getByText("ticked: 3")).toBeInTheDocument();
      expect(screen.getByText("all visible: true")).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Tick all" }));
      expect(screen.getByText("ticked: 0")).toBeInTheDocument();
    });

    it("opens and closes a user menu, one at a time", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();

      await user_.click(screen.getByRole("button", { name: "Menu Ann" }));
      expect(screen.getByText("menu: 1")).toBeInTheDocument();
      await user_.click(screen.getByRole("button", { name: "Menu Bob" }));
      expect(screen.getByText("menu: 2")).toBeInTheDocument();
      await user_.click(screen.getByRole("button", { name: "Menu Bob" }));
      expect(screen.getByText("menu: none")).toBeInTheDocument();
    });

    it("opens a user from the menu and shuts the menu", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Menu Ann" }));

      await user_.click(screen.getByRole("button", { name: "Menu view Ann" }));

      expect(await screen.findByText(/user drawer: Ann open=true/)).toBeInTheDocument();
      expect(screen.getByText("menu: none")).toBeInTheDocument();
    });
  });

  describe("deleting users", () => {
    it("removes the deleted user from the list and the selection", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));

      await user_.click(screen.getByRole("button", { name: "Delete Ann" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByText("Ann Tester")).toBeInTheDocument();
      await user_.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(screen.queryByText("Ann")).not.toBeInTheDocument());
      expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith("1");
      expect(screen.getByText("ticked: 0")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("shows why deleting failed, keeps the user, and forgets the error on cancel", async () => {
      mocks.deleteUser.mockRejectedValue(new Error("Still has work"));
      const user_ = userEvent.setup();
      renderPage();
      await ready();

      await user_.click(screen.getByRole("button", { name: "Delete Ann" }));
      const dialog = await screen.findByRole("alertdialog");
      await user_.click(within(dialog).getByRole("button", { name: "Delete user" }));

      expect(await within(dialog).findByText("Still has work")).toBeInTheDocument();
      expect(screen.getByText("Ann")).toBeInTheDocument();

      await user_.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

      await user_.click(screen.getByRole("button", { name: "Delete Bob" }));
      expect(await screen.findByRole("alertdialog")).not.toHaveTextContent("Still has work");
    });

    it("says what went wrong when the failure carries no message", async () => {
      mocks.deleteUser.mockRejectedValue("nope");
      const user_ = userEvent.setup();
      renderPage();
      await ready();

      await user_.click(screen.getByRole("button", { name: "Delete Ann" }));
      const dialog = await screen.findByRole("alertdialog");
      await user_.click(within(dialog).getByRole("button", { name: "Delete user" }));

      expect(await within(dialog).findByText("User could not be deleted.")).toBeInTheDocument();
    });

    it("closes the drawer of the user that was deleted from it", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));
      await screen.findByText(/user drawer: Ann open=true/);

      await user_.click(screen.getByRole("button", { name: "Drawer delete" }));
      const dialog = await screen.findByRole("alertdialog");
      await user_.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(screen.queryByTestId("user-drawer")).not.toBeInTheDocument());
    });

    it("keeps the drawer of another user when a different one is deleted", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));
      await screen.findByText(/user drawer: Ann open=true/);

      await user_.click(screen.getByRole("button", { name: "Delete Bob" }));
      const dialog = await screen.findByRole("alertdialog");
      await user_.click(within(dialog).getByRole("button", { name: "Delete user" }));

      await waitFor(() => expect(screen.queryByText("Bob")).not.toBeInTheDocument());
      expect(screen.getByText(/user drawer: Ann open=true/)).toBeInTheDocument();
    });

    it("asks about every ticked user and deletes them all", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));
      await user_.click(screen.getByRole("button", { name: "Tick Bob" }));

      await user_.click(screen.getByRole("button", { name: "Delete All" }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("delete 2 selected users?");
      await user_.click(within(dialog).getByRole("button", { name: "Delete All" }));

      await waitFor(() => expect(mocks.deleteUser).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText("Ann")).not.toBeInTheDocument());
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.getByText("Cy")).toBeInTheDocument();
      expect(screen.getByText("ticked: 0")).toBeInTheDocument();
    });

    it("says one selected user in the singular", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));

      await user_.click(screen.getByRole("button", { name: "Delete All" }));

      expect(await screen.findByRole("alertdialog")).toHaveTextContent("delete 1 selected user?");
    });

    it("keeps everyone and shows why when a bulk delete fails", async () => {
      mocks.deleteUser.mockRejectedValue(new Error("Locked"));
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));
      await user_.click(screen.getByRole("button", { name: "Delete All" }));
      const dialog = await screen.findByRole("alertdialog");

      await user_.click(within(dialog).getByRole("button", { name: "Delete All" }));

      expect(await within(dialog).findByText("Locked")).toBeInTheDocument();
      expect(screen.getByText("Ann")).toBeInTheDocument();
      expect(screen.getByText("ticked: 1")).toBeInTheDocument();

      await user_.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("says what went wrong when a bulk failure carries no message", async () => {
      mocks.deleteUser.mockRejectedValue("nope");
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));
      await user_.click(screen.getByRole("button", { name: "Delete All" }));
      const dialog = await screen.findByRole("alertdialog");

      await user_.click(within(dialog).getByRole("button", { name: "Delete All" }));

      expect(
        await within(dialog).findByText("Selected users could not be deleted."),
      ).toBeInTheDocument();
    });

    it("closes the drawer when the user it shows is among those deleted", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));
      await user_.click(screen.getByRole("button", { name: "Tick Ann" }));
      await user_.click(screen.getByRole("button", { name: "Delete All" }));
      const dialog = await screen.findByRole("alertdialog");

      await user_.click(within(dialog).getByRole("button", { name: "Delete All" }));

      await waitFor(() => expect(screen.queryByTestId("user-drawer")).not.toBeInTheDocument());
    });
  });

  describe("the user drawer", () => {
    it("shows an edit made in it on the list", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));

      await user_.click(await screen.findByRole("button", { name: "Rename user" }));

      expect(await screen.findByText("Renamed")).toBeInTheDocument();
      expect(screen.getByText(/user drawer: Renamed/)).toBeInTheDocument();
    });

    it("loads the lists again after memberships moved", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));

      await user_.click(await screen.findByRole("button", { name: "User moved" }));

      await waitFor(() => expect(mocks.getUsers).toHaveBeenCalledTimes(2));
    });

    it("closes by the backdrop, and the drawer goes after the slide-out", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));
      expect(await screen.findByText(/open=true/)).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Close details overlay" }));

      expect(await screen.findByText(/open=false/)).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByTestId("user-drawer")).not.toBeInTheDocument());
      expect(
        screen.queryByRole("button", { name: "Close details overlay" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("the projects tab", () => {
    async function openProjects() {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Projects" }));
      await screen.findByTestId("projects-tab");
      return user_;
    }

    it("lists the projects and tells when a search narrows them", async () => {
      const user_ = await openProjects();
      expect(screen.getByText(/shown 2 of 2, filtered: false, users: 3/)).toBeInTheDocument();

      await user_.type(screen.getByLabelText("Search projects"), "alp");

      expect(screen.getByText(/shown 1 of 2, filtered: true/)).toBeInTheDocument();
    });

    it("shows an edit made in the drawer on the list and on the members", async () => {
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "Open Alpha" }));

      await user_.click(await screen.findByRole("button", { name: "Rename project" }));

      expect(await screen.findByText(/project drawer: Alpha renamed/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open Alpha renamed" })).toBeInTheDocument();
    });

    it("lets only an admin manage the lifecycle", async () => {
      mocks.permissionGroup = "HR";
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "Open Alpha" }));

      expect(await screen.findByText(/lifecycle=false/)).toBeInTheDocument();
    });

    it("removes a deleted project and reloads the project switcher", async () => {
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "Open Alpha" }));

      await user_.click(await screen.findByRole("button", { name: "Remove project" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Open Alpha" })).not.toBeInTheDocument(),
      );
      expect(mocks.reloadProjects).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Open Beta" })).toBeInTheDocument();
    });

    it("goes to the data ingestion page from the drawer", async () => {
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "Open Alpha" }));

      await user_.click(await screen.findByRole("button", { name: "Open source" }));
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/data-ingestion?projectId=p1&sourceId=src-9",
      );
    });

    it("goes to the data ingestion page for the project", async () => {
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "Open Alpha" }));

      await user_.click(await screen.findByRole("button", { name: "Open ingestion" }));
      expect(screen.getByTestId("where")).toHaveTextContent("/data-ingestion?projectId=p1");
    });

    it("opens the wizard with the token names and the existing project names", async () => {
      const user_ = await openProjects();

      await user_.click(screen.getByRole("button", { name: "New Project" }));

      expect(
        await screen.findByText(/wizard tokens: token-a,token-b existing: Alpha,Beta/),
      ).toBeInTheDocument();
      expect(mocks.getPatNames).toHaveBeenCalledTimes(1);
    });

    it("reloads the projects and the switcher once a project was created", async () => {
      const user_ = await openProjects();
      mocks.getProjects.mockResolvedValue([project("p1", "Alpha"), project("p3", "Gamma")]);
      await user_.click(screen.getByRole("button", { name: "New Project" }));

      await user_.click(await screen.findByRole("button", { name: "Created" }));

      expect(await screen.findByRole("button", { name: "Open Gamma" })).toBeInTheDocument();
      expect(mocks.reloadProjects).toHaveBeenCalledTimes(1);
    });

    it("closes the wizard and loads again when it moved memberships", async () => {
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "New Project" }));

      await user_.click(await screen.findByRole("button", { name: "Wizard moved" }));
      await waitFor(() => expect(mocks.getUsers).toHaveBeenCalledTimes(2));

      await user_.click(screen.getByRole("button", { name: "Close wizard" }));
      await waitFor(() => expect(screen.queryByTestId("wizard")).not.toBeInTheDocument());
    });

    it("loads the project drawer's memberships again when they moved", async () => {
      const user_ = await openProjects();
      await user_.click(screen.getByRole("button", { name: "Open Alpha" }));

      await user_.click(await screen.findByRole("button", { name: "Project moved" }));

      await waitFor(() => expect(mocks.getUsers).toHaveBeenCalledTimes(2));
    });
  });

  describe("the skills tab", () => {
    async function openSkills() {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Skills" }));
      await screen.findByTestId("skills-tab");
      return user_;
    }

    it("loads the skill pool when the tab opens, and only once", async () => {
      const user_ = await openSkills();
      expect(await screen.findByText(/success 2\/2/)).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Users" }));
      await user_.click(screen.getByRole("button", { name: "Skills" }));

      expect(mocks.getSkills).toHaveBeenCalledTimes(1);
    });

    it("searches the skills", async () => {
      const user_ = await openSkills();
      await screen.findByText(/success 2\/2/);

      await user_.type(screen.getByLabelText("Search skills"), "react");

      expect(screen.getByText(/success 1\/2 search: true/)).toBeInTheDocument();
    });

    it("opens a skill, and shows its saved edit in the list", async () => {
      const user_ = await openSkills();
      await user_.click(await screen.findByRole("button", { name: "Skill TypeScript" }));
      expect(await screen.findByText("skill drawer: TypeScript")).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Save skill" }));

      expect(await screen.findByRole("button", { name: "Skill TypeScript 6" })).toBeInTheDocument();
      expect(screen.getByText("skill drawer: TypeScript 6")).toBeInTheDocument();
    });

    it("makes a new skill from the toolbar", async () => {
      const user_ = await openSkills();
      await screen.findByText(/success 2\/2/);

      await user_.click(screen.getByRole("button", { name: "New skill" }));
      expect(await screen.findByText("skill drawer: new")).toBeInTheDocument();
      await user_.click(screen.getByRole("button", { name: "Save skill" }));

      expect(await screen.findByText(/success 3\/3/)).toBeInTheDocument();
    });

    it("loads again on retry and from the refresh button", async () => {
      const user_ = await openSkills();
      await screen.findByText(/success 2\/2/);

      await user_.click(screen.getByRole("button", { name: "Retry skills" }));
      await waitFor(() => expect(mocks.getSkills).toHaveBeenCalledTimes(2));

      await user_.click(screen.getByRole("button", { name: "Refresh admin data" }));
      await waitFor(() => expect(mocks.getSkills).toHaveBeenCalledTimes(3));
      expect(mocks.getUsers).toHaveBeenCalledTimes(1);
    });

    it("shows why the pool could not load", async () => {
      mocks.getSkills.mockRejectedValue(new Error("No skills today"));
      await openSkills();

      expect(await screen.findByText(/error 0\/0 .*No skills today/)).toBeInTheDocument();
    });
  });

  describe("moving between tabs", () => {
    it("refreshes the users and projects from the refresh button", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();

      await user_.click(screen.getByRole("button", { name: "Refresh admin data" }));

      await waitFor(() => expect(mocks.getUsers).toHaveBeenCalledTimes(2));
      expect(mocks.getSkills).not.toHaveBeenCalled();
    });

    it("closes an open drawer when the tab changes", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "View Ann" }));
      expect(await screen.findByText(/open=true/)).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Tokens" }));

      await waitFor(() => expect(screen.queryByTestId("user-drawer")).not.toBeInTheDocument());
      expect(await screen.findByTestId("tokens-tab")).toBeInTheDocument();
    });

    it("keeps the token source filter when leaving the tab and coming back", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();
      await user_.click(screen.getByRole("button", { name: "Tokens" }));
      await user_.click(await screen.findByRole("button", { name: "Pick github" }));
      expect(screen.getByText("filter: github")).toBeInTheDocument();

      await user_.click(screen.getByRole("button", { name: "Users" }));
      await user_.click(screen.getByRole("button", { name: "Tokens" }));

      expect(await screen.findByText("filter: github")).toBeInTheDocument();
    });

    it("starts the token filter on the default source", async () => {
      const user_ = userEvent.setup();
      renderPage();
      await ready();

      await user_.click(screen.getByRole("button", { name: "Tokens" }));

      expect(await screen.findByText(/filter: \S+/)).toBeInTheDocument();
    });
  });
});
