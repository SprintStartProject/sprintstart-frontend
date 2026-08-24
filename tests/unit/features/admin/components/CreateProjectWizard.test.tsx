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
  getGithubPatNames: vi.fn(),
  addGithubPat: vi.fn(),
}));

vi.mock("../../../../../src/services/ingestionService", () => ({
  getIngestionSourceStatuses: vi.fn(),
}));

vi.mock("../../../../../src/services/sources/jiraService", () => ({
  connectJiraInstance: vi.fn(),
  getMyJiraCredentials: vi.fn(),
  addJiraCredential: vi.fn(),
}));

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: { uploadDocuments: vi.fn() },
}));

import { projectService } from "../../../../../src/services/projectService";
import {
  addGithubPat,
  addRepositoryToProject,
  connectGithubRepository,
  discoverRepositories,
  getGithubPatNames,
} from "../../../../../src/services/sources/githubService";
import {
  addJiraCredential,
  connectJiraInstance,
  getMyJiraCredentials,
} from "../../../../../src/services/sources/jiraService";
import { knowledgeService } from "../../../../../src/services/knowledgeService";
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

/** Fills in the name on the details step. */
async function fillName(user: ReturnType<typeof userEvent.setup>) {
  await settleModalFocus();
  await user.type(screen.getByLabelText(/^Name/), "Apollo");
}

/** Details → members. */
async function goToMembers(user: ReturnType<typeof userEvent.setup>) {
  await fillName(user);
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

/** Details → members → sources. */
async function goToSources(user: ReturnType<typeof userEvent.setup>) {
  await goToMembers(user);
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

/** From the sources step, open the add-source flow and pick the GitHub type. */
async function openGithubDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add source/i }));
  await user.click(screen.getByRole("button", { name: /indexes repositories/i }));
}

/** Runs GitHub discovery for an owner and waits for the results to render. */
async function discover(user: ReturnType<typeof userEvent.setup>, owner = "acme") {
  await user.type(screen.getByLabelText("Organization, user, or URL"), owner);
  await user.click(screen.getByRole("button", { name: /discover/i }));
}

/** Stages `widgets` as a GitHub source and returns to the sources list. */
async function stageWidgets(user: ReturnType<typeof userEvent.setup>) {
  await openGithubDetail(user);
  await discover(user);
  await user.click(await screen.findByRole("checkbox", { name: /widgets/i }));
  await user.click(screen.getByRole("button", { name: /add to list/i }));
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
    vi.mocked(getGithubPatNames).mockResolvedValue(["team-pat"]);
    vi.mocked(addGithubPat).mockResolvedValue(undefined);
    vi.mocked(addJiraCredential).mockResolvedValue(undefined);
    vi.mocked(projectService.assignUsersToProject).mockResolvedValue([]);
    vi.mocked(connectJiraInstance).mockResolvedValue(undefined);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      { userEmail: "me@example.com", displayName: "Team token" },
    ]);
    vi.mocked(knowledgeService.uploadDocuments).mockResolvedValue([
      { filename: "spec.md", status: "success" },
    ]);
  });

  /** From the sources step, stage a Jira board through the add-source sub-flow. */
  async function stageJiraBoard(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /indexes jira issues/i }));

    // The stored credential is adopted automatically once it loads; the
    // FilterSelect combobox shows it as the selected label.
    await screen.findByText(/Team token - me@example.com/i);

    await user.type(screen.getByLabelText("Display name"), "Team board");
    await user.type(screen.getByLabelText("Instance URL"), "https://acme.atlassian.net");
    await user.click(screen.getByRole("button", { name: /add to list/i }));
  }

  it("keeps details on a blank name and explains why instead of a dead button", async () => {
    const user = userEvent.setup();
    renderWizard();
    await settleModalFocus();

    // Continue stays enabled so the click can surface the reason rather than
    // sitting there disabled with no explanation.
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    // Still on the Details step — the manager picker is a details-only control.
    expect(screen.getByLabelText("Project manager")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Name/), "Apollo");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // A valid name advances to the members step.
    expect(await screen.findByLabelText("Add members")).toBeInTheDocument();
  });

  it("flags a duplicate name before the commit and keeps the user on details", async () => {
    const user = userEvent.setup();
    renderWizard({ existingProjectNames: ["Apollo"] });
    await settleModalFocus();

    // Case-insensitive clash with an existing project.
    await user.type(screen.getByLabelText(/^Name/), "apollo");

    expect(await screen.findByText("A project with this name already exists.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Blocked on details; nothing was sent to the backend.
    expect(screen.getByLabelText("Project manager")).toBeInTheDocument();
    expect(vi.mocked(projectService.createProject)).not.toHaveBeenCalled();
  });

  it("asks before discarding a dirty wizard and only closes on confirm", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWizard();
    await fillName(user);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // The confirmation intercepts; the wizard is still open.
    expect(await screen.findByText("Discard this project?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /keep editing/i }));
    await waitFor(() =>
      expect(screen.queryByText("Discard this project?")).not.toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();

    // Cancelling again and confirming the discard closes the wizard.
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes a pristine wizard without a discard prompt", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWizard();
    await settleModalFocus();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText("Discard this project?")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("jumps back to a completed step from the stepper", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToSources(user);

    // Completed steps are buttons; the current/future ones are not.
    await user.click(screen.getByRole("button", { name: "Go to Details" }));

    expect(await screen.findByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByLabelText("Project manager")).toBeInTheDocument();
  });

  it("keeps the manager on the details step and members on their own step", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max")] });
    await settleModalFocus();

    // Manager lives with the details, members do not.
    expect(screen.getByLabelText("Project manager")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add members")).not.toBeInTheDocument();

    await goToMembers(user);

    expect(screen.getByLabelText("Add members")).toBeInTheDocument();
    expect(screen.queryByLabelText("Project manager")).not.toBeInTheDocument();
  });

  it("creates the project without sources and closes immediately", async () => {
    const user = userEvent.setup();
    const { onClose, onProjectCreated } = renderWizard();

    await goToSources(user);
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

  it("assigns the chosen manager, picked on the details step", async () => {
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

    // The manager picker is the animated FilterSelect combobox: wait for the
    // candidates to load (it enables), open it, then pick the option.
    const managerSelect = screen.getByLabelText("Project manager");
    await waitFor(() => expect(managerSelect).toBeEnabled());
    await user.click(managerSelect);
    await user.click(await screen.findByRole("option", { name: "Jane Doe" }));

    await user.type(screen.getByLabelText(/^Name/), "Apollo");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() =>
      expect(vi.mocked(projectService.setProjectManager)).toHaveBeenCalledWith(
        "proj-new",
        "user-7",
      ),
    );
  });

  it("assigns every picked member to the new project in one request", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max"), adminUser("u2", "Lena")] });

    await goToMembers(user);
    await user.click(screen.getByRole("checkbox", { name: "Add Max Mustermann to the project" }));
    await user.click(screen.getByRole("checkbox", { name: "Add Lena Mustermann to the project" }));

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() =>
      expect(projectService.assignUsersToProject).toHaveBeenCalledWith("proj-new", {
        userIds: ["u1", "u2"],
      }),
    );
    expect(projectService.assignUsersToProject).toHaveBeenCalledTimes(1);
  });

  it("does not assign anyone when no member was picked", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max")] });

    await goToSources(user);
    await user.click(screen.getByRole("button", { name: /create without sources/i }));

    await waitFor(() => expect(projectService.createProject).toHaveBeenCalled());
    expect(projectService.assignUsersToProject).not.toHaveBeenCalled();
  });

  it("stages repositories then connects them against the new project on Create", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);

    // Stage two repositories through the add-source sub-flow.
    await openGithubDetail(user);
    await discover(user);
    await user.click(await screen.findByRole("checkbox", { name: /widgets/i }));
    await user.click(screen.getByRole("checkbox", { name: /gadgets/i }));
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    // Back on the sources list, both are staged.
    expect(screen.getByText("acme/widgets")).toBeInTheDocument();
    expect(screen.getByText("acme/gadgets")).toBeInTheDocument();

    // Continue → Review → Create project drives provisioning.
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(vi.mocked(connectGithubRepository)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(connectGithubRepository)).toHaveBeenCalledWith({
      owner: "acme",
      name: "widgets",
      tokenName: "team-pat",
      projectId: "proj-new",
    });
  });

  it("connects staged sources without a review via Create, skip review", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);
    await stageWidgets(user);

    await user.click(screen.getByRole("button", { name: /create, skip review/i }));

    await waitFor(() =>
      expect(vi.mocked(connectGithubRepository)).toHaveBeenCalledWith(
        expect.objectContaining({ name: "widgets", projectId: "proj-new" }),
      ),
    );
    // The provisioning screen is now shown, with a Done button to close.
    expect(await screen.findByRole("button", { name: /done/i })).toBeInTheDocument();
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

    await goToSources(user);
    await openGithubDetail(user);
    await discover(user);
    await user.click(await screen.findByRole("checkbox", { name: /linked/i }));
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(vi.mocked(addRepositoryToProject)).toHaveBeenCalledWith("repo-42", "proj-new"),
    );
    expect(vi.mocked(connectGithubRepository)).not.toHaveBeenCalled();
  });

  it("keeps the project and offers a retry when a source fails to connect", async () => {
    vi.mocked(connectGithubRepository).mockRejectedValueOnce(new Error("token expired"));
    const user = userEvent.setup();
    const { onClose, onProjectCreated } = renderWizard();

    await goToSources(user);
    await stageWidgets(user);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(screen.getByText("token expired")).toBeInTheDocument());
    // The project itself succeeded, so it is reported and the wizard stays on the
    // provisioning screen instead of discarding the staged list.
    expect(onProjectCreated).toHaveBeenCalledWith(createdProject);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText(/Connected · team-pat/i)).toBeInTheDocument());
    // The retry must not create a second project.
    expect(vi.mocked(projectService.createProject)).toHaveBeenCalledTimes(1);
  });

  it("stages a Jira board and connects it against the new project on Create", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);
    await stageJiraBoard(user);

    // Back on the sources list, the board is staged under its display name.
    expect(screen.getByText("Team board")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(vi.mocked(connectJiraInstance)).toHaveBeenCalledWith({
        displayName: "Team board",
        url: "https://acme.atlassian.net",
        userEmail: "me@example.com",
        tokenName: "Team token",
        projectId: "proj-new",
      }),
    );
  });

  it("connects a mixed batch of a GitHub repo and a Jira board", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);
    await stageWidgets(user);
    await stageJiraBoard(user);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(vi.mocked(connectJiraInstance)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(connectGithubRepository)).toHaveBeenCalledWith(
      expect.objectContaining({ name: "widgets", projectId: "proj-new" }),
    );
    expect(vi.mocked(connectJiraInstance)).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://acme.atlassian.net", projectId: "proj-new" }),
    );
  });

  it("stages uploaded files and uploads them against the new project on Create", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /indexes manually uploaded/i }));

    const file = new File(["hello"], "spec.md", { type: "text/markdown" });
    await user.upload(screen.getByTestId("file-input"), file);

    // The staged file is listed before anything is uploaded.
    expect(screen.getByText("spec.md")).toBeInTheDocument();
    expect(vi.mocked(knowledgeService.uploadDocuments)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /add to list/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(vi.mocked(knowledgeService.uploadDocuments)).toHaveBeenCalledWith("proj-new", [file]),
    );
    // Uploads run only after the project exists.
    expect(vi.mocked(projectService.createProject)).toHaveBeenCalledTimes(1);
  });

  it("adds a GitHub token inline and selects the new one", async () => {
    vi.mocked(getGithubPatNames)
      .mockResolvedValueOnce([]) // initial load: no tokens yet
      .mockResolvedValue(["fresh-pat"]); // after the inline add
    const user = userEvent.setup();
    renderWizard({ tokenNames: [] });

    await goToSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /indexes repositories/i }));

    await user.click(screen.getByRole("button", { name: /add github token/i }));
    await user.type(screen.getByTestId("settings-add-token-name"), "fresh-pat");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_secret123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() =>
      expect(vi.mocked(addGithubPat)).toHaveBeenCalledWith("fresh-pat", "ghp_secret123"),
    );
    // The refreshed token is adopted and shown as the FilterSelect's label.
    await waitFor(() =>
      expect(screen.getByLabelText("Access token")).toHaveTextContent("fresh-pat"),
    );
  });

  it("adds a Jira credential inline and selects the new one", async () => {
    vi.mocked(getMyJiraCredentials)
      .mockResolvedValueOnce([]) // initial load: none stored
      .mockResolvedValue([{ userEmail: "new@example.com", displayName: "Fresh cred" }]);
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /indexes jira issues/i }));

    await user.click(screen.getByRole("button", { name: /add jira credential/i }));
    await user.type(screen.getByTestId("settings-jira-add-email"), "new@example.com");
    await user.type(screen.getByTestId("settings-jira-add-name"), "Fresh cred");
    await user.type(screen.getByTestId("settings-jira-add-token"), "jira-token");
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() =>
      expect(vi.mocked(addJiraCredential)).toHaveBeenCalledWith({
        userEmail: "new@example.com",
        tokenName: "Fresh cred",
        authToken: "jira-token",
      }),
    );
    // The refreshed credential is adopted and shown as the FilterSelect's label.
    await screen.findByText(/Fresh cred - new@example.com/i);
    expect(screen.getByLabelText("Credential")).toHaveTextContent("Fresh cred");
  });

  it("keeps the new GitHub token visible and selected when the post-add refetch fails", async () => {
    // The add succeeds and persists the token, but the follow-up list read
    // fails. Without the optimistic insert this stranded the picker on "no
    // saved tokens" and a re-add hit the backend's duplicate error.
    let added = false;
    vi.mocked(addGithubPat).mockImplementation(() => {
      added = true;
      return Promise.resolve();
    });
    vi.mocked(getGithubPatNames).mockImplementation(() =>
      added ? Promise.reject(new Error("Network error")) : Promise.resolve([]),
    );
    const user = userEvent.setup();
    renderWizard({ tokenNames: [] });

    await goToSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /indexes repositories/i }));

    await user.click(screen.getByRole("button", { name: /add github token/i }));
    await user.type(screen.getByTestId("settings-add-token-name"), "fresh-pat");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_secret123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() => expect(vi.mocked(addGithubPat)).toHaveBeenCalledTimes(1));
    // The token shows and is selected despite the failed reload, so no second
    // add (and no duplicate error) is needed.
    await waitFor(() =>
      expect(screen.getByLabelText("Access token")).toHaveTextContent("fresh-pat"),
    );
    expect(screen.queryByText(/no token yet/i)).not.toBeInTheDocument();
    expect(vi.mocked(addGithubPat)).toHaveBeenCalledTimes(1);
  });

  it("keeps the new Jira credential visible and selected when the post-add refetch fails", async () => {
    let added = false;
    vi.mocked(addJiraCredential).mockImplementation(() => {
      added = true;
      return Promise.resolve();
    });
    vi.mocked(getMyJiraCredentials).mockImplementation(() =>
      added ? Promise.reject(new Error("Network error")) : Promise.resolve([]),
    );
    const user = userEvent.setup();
    renderWizard();

    await goToSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /indexes jira issues/i }));

    await user.click(screen.getByRole("button", { name: /add jira credential/i }));
    await user.type(screen.getByTestId("settings-jira-add-email"), "new@example.com");
    await user.type(screen.getByTestId("settings-jira-add-name"), "Fresh cred");
    await user.type(screen.getByTestId("settings-jira-add-token"), "jira-token");
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() => expect(vi.mocked(addJiraCredential)).toHaveBeenCalledTimes(1));
    await screen.findByText(/Fresh cred - new@example.com/i);
    expect(screen.getByLabelText("Credential")).toHaveTextContent("Fresh cred");
    expect(vi.mocked(addJiraCredential)).toHaveBeenCalledTimes(1);
  });

  it("does not create the project when cancelled on the first step", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWizard();
    await settleModalFocus();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(vi.mocked(projectService.createProject)).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("filters the member list without losing what is already picked", async () => {
    const user = userEvent.setup();
    renderWizard({ users: [adminUser("u1", "Max"), adminUser("u2", "Lena")] });

    await goToMembers(user);
    await user.click(screen.getByRole("checkbox", { name: "Add Max Mustermann to the project" }));
    await user.type(screen.getByLabelText("Add members"), "lena");

    expect(
      screen.queryByRole("checkbox", { name: "Add Max Mustermann to the project" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
