import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { AddSourceModal } from "../../../../../src/features/data-ingestion/components/AddSourceModal";
import { server } from "../../../setup/vitest.setup";

function renderModal(overrides: Partial<Parameters<typeof AddSourceModal>[0]> = {}) {
  const props = {
    projectId: "project-1",
    projectName: "Apollo",
    tokenNames: ["default"],
    canIngest: true,
    onClose: vi.fn(),
    onConnected: vi.fn(),
    ...overrides,
  };
  render(<AddSourceModal {...props} />);
  return props;
}

const discoveryHandler = http.get("/api/v1/github/discover/org/:org", () =>
  HttpResponse.json({
    repositories: [
      {
        name: "repo-a",
        private: false,
        html_url: "https://github.com/acme/repo-a",
      },
      {
        name: "repo-connected",
        private: true,
        html_url: "https://github.com/acme/repo-connected",
        alreadyConnected: true,
        isEnabled: true,
      },
    ],
  }),
);

/**
 * The per-repo status endpoint resolves repository ids for repos that are
 * already ingested. `repo-connected` belongs to another project, so it can be
 * linked to this one; `repo-here` is already a source of the current project.
 */
function sourceStatusHandler({ inThisProject = [] as string[] } = {}) {
  const row = (fullName: string, repositoryId: string) => ({
    sourceSystem: "GITHUB",
    sourceId: fullName,
    repositoryId,
    owner: fullName.split("/")[0],
    name: fullName.split("/")[1],
    sourceUrl: `https://github.com/${fullName}`,
    connectionStatus: "CONNECTED",
    enabled: true,
    artifactCount: 5,
  });

  return http.get("/api/v1/ingestion-sources/status", ({ request }) => {
    const projectId = new URL(request.url).searchParams.get("projectId");

    if (projectId) {
      return HttpResponse.json(inThisProject.map((fullName) => row(fullName, `id-${fullName}`)));
    }

    return HttpResponse.json([row("acme/repo-connected", "id-acme/repo-connected")]);
  });
}

/** Advances the wizard from the source-type step into the detail step. */
async function gotoGithubStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

function jiraCredentialsHandler(names: string[], email = "me@corp.com") {
  return http.get("/api/v1/jira/credentials", () =>
    HttpResponse.json(names.map((displayName) => ({ userEmail: email, displayName }))),
  );
}

describe("AddSourceModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts on the source-type step with GitHub, Jira and Upload choices", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /jira/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("shows the Jira connect form on the Jira step", async () => {
    server.use(jiraCredentialsHandler(["default"]));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /jira/i }));
    await gotoGithubStep(user);

    expect(screen.getByTestId("jira-display-name")).toBeInTheDocument();
    expect(screen.getByTestId("jira-instance-url")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByTestId("jira-credential")).getByRole("option", {
          name: "default - me@corp.com",
        }),
      ).toBeInTheDocument(),
    );
  });

  it("connects a Jira instance with the right body and reports success", async () => {
    let capturedBody: unknown = null;
    server.use(
      jiraCredentialsHandler(["default"]),
      http.post("/api/v1/jira/connect", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );

    const user = userEvent.setup();
    const props = renderModal();

    await user.click(screen.getByRole("button", { name: /jira/i }));
    await gotoGithubStep(user);

    await user.type(screen.getByTestId("jira-display-name"), "Team board");
    await user.type(screen.getByTestId("jira-instance-url"), "https://acme.atlassian.net");

    // Wait for the credential to load and default-select.
    await waitFor(() => expect(screen.getByTestId("jira-credential")).toHaveValue("default"));

    await user.click(screen.getByRole("button", { name: /connect jira instance/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));
    expect(props.onClose).toHaveBeenCalled();
    expect(capturedBody).toEqual({
      displayName: "Team board",
      url: "https://acme.atlassian.net",
      userEmail: "me@corp.com",
      tokenName: "default",
      projectId: "project-1",
    });
  });

  it("surfaces a 502 as an unreachable-server message", async () => {
    server.use(
      jiraCredentialsHandler(["default"]),
      http.post("/api/v1/jira/connect", () =>
        HttpResponse.json({ message: "bad gateway" }, { status: 502 }),
      ),
    );

    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /jira/i }));
    await gotoGithubStep(user);

    await user.type(screen.getByTestId("jira-display-name"), "Team board");
    await user.type(screen.getByTestId("jira-instance-url"), "https://acme.atlassian.net");
    await waitFor(() => expect(screen.getByTestId("jira-credential")).toHaveValue("default"));

    await user.click(screen.getByRole("button", { name: /connect jira instance/i }));

    expect(await screen.findByText(/Jira server could not be reached/i)).toBeInTheDocument();
  });

  it("lets an already-ingested repository be selected for linking", async () => {
    server.use(discoveryHandler, sourceStatusHandler());
    const user = userEvent.setup();
    renderModal();
    await gotoGithubStep(user);

    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));

    expect(await screen.findByText("repo-a")).toBeInTheDocument();

    const connectedRow = screen.getByText("repo-connected").closest("label") as HTMLElement;
    await waitFor(() => {
      expect(within(connectedRow).getByText("Already ingested")).toBeInTheDocument();
    });
    expect(within(connectedRow).getByRole("checkbox")).toBeEnabled();
  });

  it("keeps repositories already in this project unselectable", async () => {
    server.use(discoveryHandler, sourceStatusHandler({ inThisProject: ["acme/repo-connected"] }));
    const user = userEvent.setup();
    renderModal();
    await gotoGithubStep(user);

    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await screen.findByText("repo-a");

    const connectedRow = screen.getByText("repo-connected").closest("label") as HTMLElement;
    await waitFor(() => {
      expect(within(connectedRow).getByText("In this project")).toBeInTheDocument();
    });
    expect(within(connectedRow).getByRole("checkbox")).toBeDisabled();
  });

  it("links an already-ingested repository instead of re-ingesting it", async () => {
    let linkedPath: string | null = null;
    let connectAllCalled = false;

    server.use(
      discoveryHandler,
      sourceStatusHandler(),
      http.post("/api/v1/github/connections/:repositoryId/projects/:projectId", ({ request }) => {
        linkedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          repositoryId: "id-acme/repo-connected",
          projectIds: ["project-1"],
        });
      }),
      http.post("/api/v1/github/connect/all", () => {
        connectAllCalled = true;
        return HttpResponse.json({ transactionIdsByRepositoryId: {} });
      }),
    );

    const user = userEvent.setup();
    const props = renderModal();
    await gotoGithubStep(user);

    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await screen.findByText("repo-a");

    const connectedRow = screen.getByText("repo-connected").closest("label") as HTMLElement;
    await waitFor(() => {
      expect(within(connectedRow).getByRole("checkbox")).toBeEnabled();
    });
    await user.click(within(connectedRow).getByRole("checkbox"));

    expect(await screen.findByText(/already ingested and will be linked/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /connect 1 selected/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));
    expect(linkedPath).toBe(
      `/api/v1/github/connections/${encodeURIComponent("id-acme/repo-connected")}/projects/project-1`,
    );
    // No fetch + ingestion for a repository that is already ingested.
    expect(connectAllCalled).toBe(false);
  });

  it("filters the discovered list by name", async () => {
    server.use(discoveryHandler);
    const user = userEvent.setup();
    renderModal();
    await gotoGithubStep(user);

    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await screen.findByText("repo-a");

    await user.type(screen.getByLabelText("Filter repositories"), "connected");

    expect(screen.queryByText("repo-a")).not.toBeInTheDocument();
    expect(screen.getByText("repo-connected")).toBeInTheDocument();
  });

  it("pre-filters to a single repository when an owner/name is pasted", async () => {
    server.use(discoveryHandler);
    const user = userEvent.setup();
    renderModal();
    await gotoGithubStep(user);

    // Pasting a full repository reference discovers the owner but isolates the
    // one repository, so its sibling is filtered out of the results.
    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme/repo-connected");
    await user.click(screen.getByRole("button", { name: "Discover" }));

    expect(await screen.findByText("repo-connected")).toBeInTheDocument();
    expect(screen.queryByText("repo-a")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filter repositories")).toHaveValue("repo-connected");
  });

  it("batch-connects the selected repositories and reports success", async () => {
    let capturedBody: unknown = null;
    server.use(
      discoveryHandler,
      http.post("/api/v1/github/connect/all", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          transactionIdsByRepositoryId: { "acme/repo-a": "txn-a" },
        });
      }),
    );

    const user = userEvent.setup();
    const props = renderModal();
    await gotoGithubStep(user);

    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await screen.findByText("repo-a");

    const repoRow = screen.getByText("repo-a").closest("label") as HTMLElement;
    await user.click(within(repoRow).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /connect 1 selected/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));
    expect(props.onClose).toHaveBeenCalled();
    expect(capturedBody).toEqual({
      repositories: [
        {
          owner: "acme",
          name: "repo-a",
          tokenName: "default",
          projectId: "project-1",
        },
      ],
    });
  });

  it("can go back from the GitHub step to the source-type step", async () => {
    const user = userEvent.setup();
    renderModal();
    await gotoGithubStep(user);
    expect(screen.getByLabelText("Organization, user, or URL")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back/i }));
    // Back on the source-type step: the type cards are shown and the GitHub
    // discovery input is gone.
    expect(screen.getByRole("button", { name: /jira/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Organization, user, or URL")).not.toBeInTheDocument();
  });

  it("blocks connecting when the user may not ingest into the project", async () => {
    const user = userEvent.setup();
    renderModal({ canIngest: false, ingestBlockedReason: "Not your project." });
    await gotoGithubStep(user);
    expect(screen.getByText("Not your project.")).toBeInTheDocument();
  });
});
