import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectWizard } from "../../../../../src/features/admin/components/CreateProjectWizard";
import type { AdminProjectDetails } from "../../../../../src/services/projectService";
import type { AdminUser } from "../../../../../src/features/admin/types";
import type { DiscoveredRepository } from "../../../../../src/services/sources/githubService";
import type { SourceInstanceIngestionStatus } from "../../../../../src/features/data-ingestion/types";

vi.mock("../../../../../src/services/projectService", () => ({
  projectService: {
    createProject: vi.fn(),
    getManagerCandidates: vi.fn(),
    setProjectManager: vi.fn(),
    assignUsersToProject: vi.fn(),
  },
}));

vi.mock("../../../../../src/services/sources/githubService", () => ({
  discoverRepositories: vi.fn(),
  connectGithubRepository: vi.fn(),
  addRepositoryToProject: vi.fn(),
}));

vi.mock("../../../../../src/services/ingestionService", () => ({
  getIngestionSourceStatuses: vi.fn(),
}));

vi.mock("../../../../../src/services/sources/jiraService", () => ({
  connectJiraInstance: vi.fn(),
  getMyJiraCredentials: vi.fn(),
}));

import { projectService } from "../../../../../src/services/projectService";
import {
  addRepositoryToProject,
  connectGithubRepository,
  discoverRepositories,
} from "../../../../../src/services/sources/githubService";
import {
  connectJiraInstance,
  getMyJiraCredentials,
} from "../../../../../src/services/sources/jiraService";
import { getIngestionSourceStatuses } from "../../../../../src/services/ingestionService";

const createdProject: AdminProjectDetails = {
  id: "proj-new",
  name: "Apollo",
  description: "",
  manager: null,
  sources: [],
  users: [],
};

function adminUser(id: string, firstName: string): AdminUser {
  return {
    id,
    authId: `auth-${id}`,
    username: firstName.toLowerCase(),
    email: `${firstName.toLowerCase()}@example.com`,
    firstName,
    lastName: "Mustermann",
    roles: [],
    permissionGroup: "User",
    projects: [],
    projectIds: [],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: true,
  };
}

function repo(overrides: Partial<DiscoveredRepository> = {}): DiscoveredRepository {
  return {
    name: "widgets",
    isPrivate: false,
    url: "https://github.com/acme/widgets",
    alreadyConnected: false,
    isEnabled: null,
    ...overrides,
  };
}

/** Minimal per-repo status row; the picker only reads sourceId + repositoryId. */
function statusRow(fullName: string, repositoryId: string): SourceInstanceIngestionStatus {
  return {
    sourceId: fullName,
    repositoryId,
    owner: fullName.split("/")[0],
    name: fullName.split("/")[1],
  } as unknown as SourceInstanceIngestionStatus;
}

function renderWizard(overrides: Partial<Parameters<typeof CreateProjectWizard>[0]> = {}) {
  const onClose = vi.fn();
  const onProjectCreated = vi.fn();

  render(
    <CreateProjectWizard
      isOpen
      tokenNames={["team-pat"]}
      users={[]}
      onClose={onClose}
      onProjectCreated={onProjectCreated}
      {...overrides}
    />,
  );

  return { onClose, onProjectCreated };
}

/**
 * Lets the modal's mount-time autofocus run.
 *
 * `Modal` grabs focus inside a `requestAnimationFrame`; without waiting for it,
 * the frame can fire midway through typing and pull focus off the field, which
 * silently drops the remaining keystrokes.
 */
async function settleModalFocus() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

/** Fills in the name on step 1 and moves to the people step. */
async function goToPeopleStep(user: ReturnType<typeof userEvent.setup>) {
  await settleModalFocus();
  await user.type(screen.getByLabelText("Name"), "Apollo");
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

/** Walks past details and people to the source-type step. */
async function goToSourcesStep(user: ReturnType<typeof userEvent.setup>) {
  await goToPeopleStep(user);
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

/** From the source-type step, advance into the GitHub discovery detail. */
async function goToGithubDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

/** Runs GitHub discovery for an owner and waits for the results to render. */
async function discover(user: ReturnType<typeof userEvent.setup>, owner = "acme") {
  await user.type(screen.getByLabelText("Organization, user, or URL"), owner);
  await user.click(screen.getByRole("button", { name: /discover/i }));
}

describe("CreateProjectWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getManagerCandidates).mockResolvedValue([]);
    vi.mocked(projectService.createProject).mockResolvedValue(createdProject);
    vi.mocked(connectGithubRepository).mockResolvedValue({ transactionId: "tx" });
    vi.mocked(addRepositoryToProject).mockResolvedValue({
      repositoryId: "repo-42",
      projectIds: ["proj-new"],
    });
    vi.mocked(discoverRepositories).mockResolvedValue({
      repositories: [repo({ name: "widgets" }), repo({ name: "gadgets" })],
      hasMore: false,
      resolvedOwnerType: "org",
    });
    vi.mocked(getIngestionSourceStatuses).mockResolvedValue([]);
    vi.mocked(projectService.assignUsersToProject).mockResolvedValue([]);
    vi.mocked(connectJiraInstance).mockResolvedValue(undefined);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      { userEmail: "me@example.com", displayName: "Team token" },
    ]);
  });

  it("blocks the step-1 continue button until a name is entered", async () => {
    const user = userEvent.setup();
    renderWizard();
    await settleModalFocus();

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Apollo");

    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("creates the project without sources when the source step is skipped", async () => {
    const user = userEvent.setup();
    const { onClose, onProjectCreated } = renderWizard();

    await goToSourcesStep(user);
    await goToGithubDetail(user);
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() =>
      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith({
        name: "Apollo",
        description: undefined,
      }),
    );
    expect(vi.mocked(connectGithubRepository)).not.toHaveBeenCalled();
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
    expect(onClose).toHaveBeenCalled();
  });

  it('creates the project without sources via "Skip for now" on the source-type step', async () => {
    const user = userEvent.setup();
    const { onClose, onProjectCreated } = renderWizard();

    await goToSourcesStep(user);
    await user.click(screen.getByRole("button", { name: /skip for now/i }));

    await waitFor(() =>
      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith({
        name: "Apollo",
        description: undefined,
      }),
    );
    expect(vi.mocked(connectGithubRepository)).not.toHaveBeenCalled();
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
    expect(onClose).toHaveBeenCalled();
  });

  it("assigns the chosen manager after creating the project", async () => {
    vi.mocked(projectService.getManagerCandidates).mockResolvedValue([
      {
        id: "user-7",
        username: "jane.doe",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
      },
    ]);
    const user = userEvent.setup();
    renderWizard();
    await settleModalFocus();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Jane Doe" })).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Name"), "Apollo");
    await user.selectOptions(screen.getByLabelText("Project manager"), "user-7");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await goToGithubDetail(user);
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() =>
      expect(vi.mocked(projectService.setProjectManager)).toHaveBeenCalledWith(
        "proj-new",
        "user-7",
      ),
    );
  });

  it("connects the repositories selected in discovery against the new project id", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToSourcesStep(user);
    await goToGithubDetail(user);
    await discover(user);

    await user.click(await screen.findByRole("checkbox", { name: /widgets/i }));
    await user.click(screen.getByRole("checkbox", { name: /gadgets/i }));

    await user.click(screen.getByRole("button", { name: /create and connect 2 repositories/i }));

    await waitFor(() => expect(vi.mocked(connectGithubRepository)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(connectGithubRepository)).toHaveBeenCalledWith({
      owner: "acme",
      name: "widgets",
      tokenName: "team-pat",
      projectId: "proj-new",
    });
  });

  it("links an already-ingested repository instead of re-ingesting it", async () => {
    vi.mocked(discoverRepositories).mockResolvedValue({
      repositories: [repo({ name: "linked", alreadyConnected: true, isEnabled: true })],
      hasMore: false,
      resolvedOwnerType: "org",
    });
    vi.mocked(getIngestionSourceStatuses).mockResolvedValue([statusRow("acme/linked", "repo-42")]);
    const user = userEvent.setup();
    renderWizard();

    await goToSourcesStep(user);
    await goToGithubDetail(user);
    await discover(user);

    await user.click(await screen.findByRole("checkbox", { name: /linked/i }));
    await user.click(screen.getByRole("button", { name: /create and connect 1 repository/i }));

    await waitFor(() =>
      expect(vi.mocked(addRepositoryToProject)).toHaveBeenCalledWith("repo-42", "proj-new"),
    );
    expect(vi.mocked(connectGithubRepository)).not.toHaveBeenCalled();
  });

  it("keeps the project and offers a retry when a source fails to connect", async () => {
    vi.mocked(connectGithubRepository).mockRejectedValueOnce(new Error("token expired"));
    const user = userEvent.setup();
    const { onClose, onProjectCreated } = renderWizard();

    await goToSourcesStep(user);
    await goToGithubDetail(user);
    await discover(user);

    await user.click(await screen.findByRole("checkbox", { name: /widgets/i }));
    await user.click(screen.getByRole("button", { name: /create and connect 1 repository/i }));

    await waitFor(() => expect(screen.getByText("token expired")).toBeInTheDocument());
    // The project itself succeeded, so it is reported and the wizard stays
    // open instead of discarding the staged list.
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText(/Connected · team-pat/i)).toBeInTheDocument());
    // The retry must not create a second project.
    expect(vi.mocked(projectService.createProject)).toHaveBeenCalledTimes(1);
  });

  it("creates the project and connects a Jira instance against the new project id", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWizard();

    await goToSourcesStep(user);
    await user.click(screen.getByRole("button", { name: /indexes jira issues/i }));
    await goToGithubDetail(user);

    // The stored credential is adopted automatically once it loads.
    await screen.findByRole("option", { name: /Team token - me@example.com/i });

    await user.type(screen.getByLabelText("Display name"), "Team board");
    await user.type(screen.getByLabelText("Instance URL"), "https://acme.atlassian.net");

    await user.click(screen.getByRole("button", { name: /create and connect jira instance/i }));

    await waitFor(() =>
      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith({
        name: "Apollo",
        description: undefined,
      }),
    );
    expect(vi.mocked(connectJiraInstance)).toHaveBeenCalledWith({
      displayName: "Team board",
      url: "https://acme.atlassian.net",
      userEmail: "me@example.com",
      tokenName: "Team token",
      projectId: "proj-new",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("creates the project first so files can be uploaded to it", async () => {
    const user = userEvent.setup();
    const { onProjectCreated } = renderWizard();

    await goToSourcesStep(user);
    await user.click(screen.getByRole("button", { name: /indexes manually uploaded/i }));
    await goToGithubDetail(user);

    // Before the project exists the drop zone is withheld behind an explicit
    // "Create project" action, since uploads need a live project id.
    expect(vi.mocked(projectService.createProject)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith({
        name: "Apollo",
        description: undefined,
      }),
    );
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
    // The upload drop zone is now revealed against the created project.
    expect(await screen.findByText(/drag and drop .* files/i)).toBeInTheDocument();
  });

  it("does not create the project when the wizard is cancelled on the source step", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWizard();

    await goToSourcesStep(user);
    await user.click(screen.getByRole("button", { name: /back/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(vi.mocked(projectService.createProject)).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the member picker off the first step", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max")] });
    await settleModalFocus();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Members")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Project manager")).not.toBeInTheDocument();

    await goToPeopleStep(user);

    expect(screen.getByLabelText("Members")).toBeInTheDocument();
    expect(screen.getByLabelText("Project manager")).toBeInTheDocument();
  });

  it("assigns every picked member to the new project in one request", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max"), adminUser("u2", "Lena")] });

    await goToPeopleStep(user);
    await user.click(screen.getByRole("checkbox", { name: "Add Max Mustermann to the project" }));
    await user.click(screen.getByRole("checkbox", { name: "Add Lena Mustermann to the project" }));

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() => {
      expect(projectService.assignUsersToProject).toHaveBeenCalledWith("proj-new", {
        userIds: ["u1", "u2"],
      });
    });
    expect(projectService.assignUsersToProject).toHaveBeenCalledTimes(1);
  });

  it("does not assign anyone when no member was picked", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max")] });

    await goToSourcesStep(user);
    await goToGithubDetail(user);
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() => {
      expect(projectService.createProject).toHaveBeenCalled();
    });
    expect(projectService.assignUsersToProject).not.toHaveBeenCalled();
  });

  it("filters the member list without losing what is already picked", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max"), adminUser("u2", "Lena")] });

    await goToPeopleStep(user);
    await user.click(screen.getByRole("checkbox", { name: "Add Max Mustermann to the project" }));
    await user.type(screen.getByLabelText("Members"), "lena");

    expect(
      screen.queryByRole("checkbox", { name: "Add Max Mustermann to the project" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
