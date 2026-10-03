import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AdminPage } from "../../../src/pages/AdminPage";
import { DRAWER_CLOSE_DELAY_MS } from "../../../src/features/admin/data";
import type { AdminUser, ProjectSummary } from "../../../src/services/adminUserService";
import type {
  AdminProject,
  ProjectSource,
  ProjectUserSummary,
} from "../../../src/services/projectService";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue } = await import("../setup/projectContext");
  return { useProjectContext: () => createProjectContextValue() };
});

const authMock = vi.hoisted(() => ({ permissionGroup: undefined as string | undefined }));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "admin1",
      firstName: "Admin",
      lastName: "User",
      permissionGroup: authMock.permissionGroup,
    },
  }),
}));

const { mockGetUsers, mockDeleteUser, mockGetProjects, mockGetGithubPatNames } = vi.hoisted(() => ({
  mockGetUsers: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockGetProjects: vi.fn(),
  mockGetGithubPatNames: vi.fn(),
}));

vi.mock("../../../src/services/adminUserService", () => ({
  adminUserService: {
    getUsers: mockGetUsers,
    deleteUser: mockDeleteUser,
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    updateUserRoles: vi.fn(),
    updateUserEnabled: vi.fn(),
    getCurrentUser: vi.fn(),
    getAvailableRolesFromUsers: vi.fn(),
  },
}));

vi.mock("../../../src/services/projectService", () => ({
  projectService: {
    getProjects: mockGetProjects,
    getProjectById: vi.fn(),
    getProjectUsers: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    assignUsersToProject: vi.fn(),
    removeUserFromProject: vi.fn(),
    resetProjectMocks: vi.fn(),
  },
}));

vi.mock("../../../src/services/sources/githubService", () => ({
  getGithubPatNames: mockGetGithubPatNames,
}));

vi.mock("../../../src/features/admin/components/UsersTab", () => ({
  UsersTab: (props: {
    paginatedUsers: AdminUser[];
    onOpenUserDetails: (user: AdminUser) => void;
    onRequestUserDeleteFromMenu: (e: { stopPropagation: () => void }, user: AdminUser) => void;
    onToggleUserSelection: (id: string) => void;
  }) => (
    <div data-testid="users-tab">
      {props.paginatedUsers.map((user) => (
        <div key={user.id} data-testid={`user-row-${user.id}`}>
          <span>
            {user.firstName} {user.lastName}
          </span>
          <button onClick={() => props.onOpenUserDetails(user)}>View {user.firstName}</button>
          <button onClick={(e) => props.onRequestUserDeleteFromMenu(e, user)}>
            Delete {user.firstName}
          </button>
          <button onClick={() => props.onToggleUserSelection(user.id)}>
            Select {user.firstName}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/ProjectsTab", () => ({
  ProjectsTab: (props: {
    filteredProjects: AdminProject[];
    onOpenProjectDetails: (p: AdminProject) => void;
  }) => (
    <div data-testid="projects-tab">
      {props.filteredProjects.map((project) => (
        <div key={project.id}>
          <span>{project.name}</span>
          <button onClick={() => props.onOpenProjectDetails(project)}>Open {project.name}</button>
        </div>
      ))}
    </div>
  ),
}));

// The tokens section loads its own data through the access connector registry,
// so the stub takes no props.
vi.mock("../../../src/features/admin/components/TokensTab", () => ({
  TokensTab: () => <div data-testid="tokens-tab" />,
}));

type DrawerBack = { label: string; onBack: () => void };

vi.mock("../../../src/features/admin/components/UserDetailsDrawer", () => ({
  UserDetailsDrawer: (props: {
    user: AdminUser | null;
    isOpen: boolean;
    back?: DrawerBack;
    onOpenProjectDetails: (projectId: string) => void;
  }) => (
    <div data-testid="user-details-drawer">
      {props.isOpen && props.user ? (
        <>
          <span>{props.user.firstName} Details</span>
          <button onClick={() => props.onOpenProjectDetails("proj1")}>Open its project</button>
          {props.back && <button onClick={props.back.onBack}>{props.back.label}</button>}
        </>
      ) : null}
    </div>
  ),
}));

vi.mock("../../../src/features/admin/components/ProjectDetailsDrawer", () => ({
  ProjectDetailsDrawer: (props: {
    project: AdminProject | null;
    isOpen: boolean;
    back?: DrawerBack;
    onOpenUser?: (userId: string) => void;
  }) => (
    <div data-testid="project-details-drawer">
      {props.isOpen && props.project ? (
        <>
          <span>{props.project.name} Details</span>
          <button onClick={() => props.onOpenUser?.("1")}>Open its member</button>
          {props.back && <button onClick={props.back.onBack}>{props.back.label}</button>}
        </>
      ) : null}
    </div>
  ),
}));

function createMockUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "1",
    username: "user1",
    email: "user1@example.com",
    firstName: "John",
    lastName: "Doe",
    roles: [],
    permissionGroup: "User",
    projects: [] as ProjectSummary[],
    projectIds: [],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: true,
    ...overrides,
  };
}

function createMockProject(overrides: Partial<AdminProject> = {}): AdminProject {
  return {
    id: "proj1",
    name: "Project Alpha",
    description: "A test project",
    manager: null,
    sources: [] as ProjectSource[],
    users: [] as ProjectUserSummary[],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
    ...overrides,
  };
}

describe("AdminPage", () => {
  const mockUsers: AdminUser[] = [
    createMockUser({ id: "1", firstName: "John", lastName: "Doe", username: "johndoe" }),
    createMockUser({
      id: "2",
      firstName: "Jane",
      lastName: "Smith",
      username: "janesmith",
      enabled: false,
    }),
  ];
  const mockProjects: AdminProject[] = [createMockProject()];

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.permissionGroup = undefined;
    mockGetUsers.mockResolvedValue(mockUsers);
    mockDeleteUser.mockResolvedValue({ id: "1", deleted: true });
    mockGetProjects.mockResolvedValue(mockProjects);
    mockGetGithubPatNames.mockResolvedValue(["token1"]);
  });

  it("renders the users tab by default after loading", async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();
    });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  /*
    The dashboard's Projects card links to `/admin?tab=projects`. Before this it linked to
    `/admin` and dropped the reader on the user list — a card about projects opening a list of
    people.
  */
  it("opens on the tab named in the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=projects"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("projects-tab")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("users-tab")).not.toBeInTheDocument();
  });

  it("ignores a tab in the URL that does not exist", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=nonsense"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();
    });
  });

  it("switches to the projects tab when clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Projects" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Projects" }));

    await waitFor(() => {
      expect(screen.getByTestId("projects-tab")).toBeInTheDocument();
    });
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
  });

  describe("project filter", () => {
    const withManager = createMockProject({
      id: "p-managed",
      name: "Managed",
      manager: { id: "m1", username: "boss", email: "", firstName: "Bea", lastName: "Boss" },
    });
    const withoutManager = createMockProject({ id: "p-orphan", name: "Orphan" });

    async function openProjectsTab() {
      mockGetProjects.mockResolvedValue([withManager, withoutManager]);
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await user.click(await screen.findByRole("button", { name: "Projects" }));
      await screen.findByTestId("projects-tab");

      return user;
    }

    it("narrows the list to projects without a manager", async () => {
      const user = await openProjectsTab();

      expect(screen.getByText("2 projects")).toBeInTheDocument();

      await user.click(screen.getByRole("combobox", { name: "Filter projects" }));
      await user.click(screen.getByRole("option", { name: "Without manager" }));

      expect(await screen.findByText("1 project")).toBeInTheDocument();
      expect(screen.getByText("Orphan")).toBeInTheDocument();
      expect(screen.queryByText("Managed")).not.toBeInTheDocument();
    });

    it("combines with the search", async () => {
      const user = await openProjectsTab();

      await user.click(screen.getByRole("combobox", { name: "Filter projects" }));
      await user.click(screen.getByRole("option", { name: "Without manager" }));
      await user.type(screen.getByPlaceholderText("Search projects..."), "Managed");

      expect(await screen.findByText("0 projects")).toBeInTheDocument();
    });

    it("keeps the filter when switching to another tab and back", async () => {
      const user = await openProjectsTab();

      await user.click(screen.getByRole("combobox", { name: "Filter projects" }));
      await user.click(screen.getByRole("option", { name: "Without manager" }));
      await user.click(screen.getByRole("button", { name: "Users" }));
      await user.click(await screen.findByRole("button", { name: "Projects" }));

      expect(await screen.findByText("1 project")).toBeInTheDocument();
    });
  });

  it("switches to the tokens tab when clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tokens" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Tokens" }));

    await waitFor(() => {
      expect(screen.getByTestId("tokens-tab")).toBeInTheDocument();
    });
  });

  it("filters users by search query", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search users...");
    await user.type(searchInput, "Jane");

    await waitFor(() => {
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("opens a single delete AlertDialog when delete is requested", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Delete John")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Delete John"));

    await waitFor(() => {
      expect(screen.getByText("Delete user?")).toBeInTheDocument();
    });
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  it("confirms single user delete and calls adminUserService.deleteUser", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Delete John")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Delete John"));

    await waitFor(() => {
      expect(screen.getByText("Delete user?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete user" }));

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith("1");
    });
  });

  it("opens bulk delete AlertDialog when multiple users are selected", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Select John")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Select John"));
    await user.click(screen.getByText("Select Jane"));

    await waitFor(() => {
      expect(screen.getByText("Delete All")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete All" }));

    await waitFor(() => {
      expect(screen.getByText("Delete selected users?")).toBeInTheDocument();
    });
  });

  it("opens the user details drawer when View is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("View John")).toBeInTheDocument();
    });

    await user.click(screen.getByText("View John"));

    await waitFor(() => {
      expect(screen.getByText("John Details")).toBeInTheDocument();
    });
  });

  /*
    Closing a drawer schedules the selection to be cleared once the slide-out finishes. Opening
    something else inside that window used to let the stale timeout wipe the new selection, so
    the freshly opened drawer vanished again.
  */
  describe("drawer close race", () => {
    const waitForCloseDelay = () =>
      new Promise((resolve) => setTimeout(resolve, DRAWER_CLOSE_DELAY_MS + 100));

    it("keeps a user drawer opened right after closing another one", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await user.click(await screen.findByText("View John"));
      await waitFor(() => expect(screen.getByText("John Details")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Close details overlay" }));
      await user.click(screen.getByText("View Jane"));

      await waitForCloseDelay();

      expect(screen.getByText("Jane Details")).toBeInTheDocument();
    });

    it("keeps a project drawer opened right after switching tabs with a drawer open", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );

      await user.click(await screen.findByText("View John"));
      await waitFor(() => expect(screen.getByText("John Details")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: "Projects" }));
      await user.click(await screen.findByText("Open Project Alpha"));

      await waitForCloseDelay();

      expect(screen.getByText("Project Alpha Details")).toBeInTheDocument();
    });
  });

  describe("deep links", () => {
    function LocationProbe() {
      const location = useLocation();

      return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
    }

    function renderAt(url: string) {
      render(
        <MemoryRouter initialEntries={[url]}>
          <AdminPage />
          <LocationProbe />
        </MemoryRouter>,
      );
    }

    it("opens the project named in ?projectId= on the projects tab and strips the param", async () => {
      renderAt("/admin?projectId=proj1");

      expect(await screen.findByText("Project Alpha Details")).toBeInTheDocument();
      expect(screen.getByTestId("projects-tab")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
    });

    it("opens the user named in ?userId= and strips the param", async () => {
      renderAt("/admin?userId=2");

      expect(await screen.findByText("Jane Details")).toBeInTheDocument();
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
    });

    it("lets ?tab= and the drawer link combine without leaving anything in the URL", async () => {
      renderAt("/admin?tab=projects&projectId=proj1");

      expect(await screen.findByText("Project Alpha Details")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
    });

    it("opens nothing for an id that does not exist, but still cleans the URL", async () => {
      renderAt("/admin?projectId=nope&userId=nobody");

      // A project link still lands on the projects tab, where the project would have been.
      await waitFor(() => expect(screen.getByTestId("projects-tab")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin$/));
      expect(screen.queryByText(/Details$/)).not.toBeInTheDocument();
    });
  });

  describe("moving between drawers", () => {
    function renderPage() {
      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );
    }

    it("goes from a user to their project and back again", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText("View John"));
      await user.click(await screen.findByRole("button", { name: "Open its project" }));

      expect(await screen.findByText("Project Alpha Details")).toBeInTheDocument();
      expect(screen.queryByText("John Details")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Back to John Doe" }));

      expect(await screen.findByText("John Details")).toBeInTheDocument();
      expect(screen.queryByText("Project Alpha Details")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
    });

    it("goes from a project to one of its members and back again", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Projects" }));
      await user.click(await screen.findByText("Open Project Alpha"));
      await user.click(await screen.findByRole("button", { name: "Open its member" }));

      expect(await screen.findByText("John Details")).toBeInTheDocument();
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Back to Project Alpha" }));

      expect(await screen.findByText("Project Alpha Details")).toBeInTheDocument();
      expect(screen.getByTestId("projects-tab")).toBeInTheDocument();
    });

    it("offers no way back to a drawer opened straight from the lists", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText("View John"));

      expect(await screen.findByText("John Details")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
    });

    it("forgets where it came from once the drawer is closed", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByText("View John"));
      await user.click(await screen.findByRole("button", { name: "Open its project" }));
      await screen.findByText("Project Alpha Details");

      await user.click(screen.getByRole("button", { name: "Close details overlay" }));
      await user.click(screen.getByRole("button", { name: "Users" }));
      await user.click(await screen.findByText("View Jane"));

      expect(await screen.findByText("Jane Details")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
    });
  });

  it("shows the Skills tab for an ADMIN", async () => {
    authMock.permissionGroup = "ADMIN";
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skills" })).toBeInTheDocument();
    });
  });

  it("hides the Skills tab for HR", async () => {
    authMock.permissionGroup = "HR";
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Skills" })).not.toBeInTheDocument();
  });

  it("ignores a ?tab=skills link for a non-ADMIN viewer", async () => {
    authMock.permissionGroup = "HR";
    render(
      <MemoryRouter initialEntries={["/admin?tab=skills"]}>
        <AdminPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("users-tab")).toBeInTheDocument();
    });
  });
});
