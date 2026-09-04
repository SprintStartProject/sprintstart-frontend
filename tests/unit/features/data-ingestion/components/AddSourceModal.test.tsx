import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { AddSourceModal } from "../../../../../src/features/data-ingestion/components/AddSourceModal";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
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
  // The connect run reports its outcome via toasts, so the modal needs a
  // ToastProvider around it for those to mount.
  render(<AddSourceModal {...props} />, { wrapper: ToastProvider });
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

function jiraCredentialsHandler(names: string[], email = "me@corp.com") {
  return http.get("/api/v1/jira/credentials", () =>
    HttpResponse.json(names.map((displayName) => ({ userEmail: email, displayName }))),
  );
}

/** Drills into the GitHub detail from the type grid the modal opens on. */
async function gotoGithubStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /github/i }));
}

/** Discovers `acme` and stages `repo-a` via "Add to list", landing on the list. */
async function stageRepoA(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
  await user.click(screen.getByRole("button", { name: "Discover" }));
  await screen.findByText("repo-a");

  const repoRow = screen.getByText("repo-a").closest("label") as HTMLElement;
  await user.click(within(repoRow).getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /add to list/i }));
}

describe("AddSourceModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The modal re-fetches stored PAT names for the inline "add token" flow; keep
    // the discovery token picker populated so the GitHub step stays usable.
    server.use(http.get("/api/v1/github/pat", () => HttpResponse.json(["default"])));
  });

  it("opens directly on the source-type chooser", () => {
    renderModal();

    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /jira/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("offers both 'Add to list' and 'Connect now' on a detail screen", async () => {
    server.use(jiraCredentialsHandler(["default"]));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /jira/i }));

    expect(screen.getByTestId("jira-display-name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to list/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect now/i })).toBeInTheDocument();
    // The credential FilterSelect adopts the first credential as its label.
    await waitFor(() =>
      expect(screen.getByLabelText("Credential")).toHaveTextContent("default - me@corp.com"),
    );
  });

  it("stages a Jira instance and connects the list", async () => {
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
    await user.type(screen.getByTestId("jira-display-name"), "Team board");
    await user.type(screen.getByTestId("jira-instance-url"), "https://acme.atlassian.net");
    await waitFor(() => expect(screen.getByLabelText("Credential")).toHaveTextContent("default"));

    await user.click(screen.getByRole("button", { name: /add to list/i }));

    // Back on the list, the staged instance shows and connecting is enabled.
    expect(await screen.findByText("Team board")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /connect 1 source/i }));

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

  it("connects a source immediately with 'Connect now'", async () => {
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
    await user.type(screen.getByTestId("jira-display-name"), "Team board");
    await user.type(screen.getByTestId("jira-instance-url"), "https://acme.atlassian.net");
    await waitFor(() => expect(screen.getByLabelText("Credential")).toHaveTextContent("default"));

    // Skips the staged-list step entirely.
    await user.click(screen.getByRole("button", { name: /connect now/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));
    expect(props.onClose).toHaveBeenCalled();
    expect(capturedBody).toMatchObject({
      displayName: "Team board",
      url: "https://acme.atlassian.net",
      projectId: "project-1",
    });
  });

  it("surfaces a failed connect on the connecting screen with a retry", async () => {
    server.use(
      jiraCredentialsHandler(["default"]),
      http.post("/api/v1/jira/connect", () =>
        HttpResponse.json({ message: "bad gateway" }, { status: 502 }),
      ),
    );

    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /jira/i }));
    await user.type(screen.getByTestId("jira-display-name"), "Team board");
    await user.type(screen.getByTestId("jira-instance-url"), "https://acme.atlassian.net");
    await waitFor(() => expect(screen.getByLabelText("Credential")).toHaveTextContent("default"));
    await user.click(screen.getByRole("button", { name: /connect now/i }));

    // The failed row stays on the connecting screen with a retry action.
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
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
    let singleConnectCalled = false;

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
      http.post("/api/v1/github/connect", () => {
        singleConnectCalled = true;
        return HttpResponse.json({ transactionId: "txn" });
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
    await user.click(screen.getByRole("button", { name: /connect now/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));
    expect(linkedPath).toBe(
      `/api/v1/github/connections/${encodeURIComponent("id-acme/repo-connected")}/projects/project-1`,
    );
    // No fetch + ingestion for a repository that is already ingested.
    expect(singleConnectCalled).toBe(false);
  });

  it("tells the PM a linked repository was reused instead of promising an ingestion", async () => {
    server.use(
      discoveryHandler,
      sourceStatusHandler(),
      http.post("/api/v1/github/connections/:repositoryId/projects/:projectId", () =>
        HttpResponse.json({
          repositoryId: "id-acme/repo-connected",
          projectIds: ["project-1"],
        }),
      ),
    );

    const user = userEvent.setup();
    const props = renderModal();
    await gotoGithubStep(user);

    await user.type(screen.getByLabelText("Organization, user, or URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await screen.findByText("repo-a");

    const connectedRow = screen.getByText("repo-connected").closest("label") as HTMLElement;
    await waitFor(() => expect(within(connectedRow).getByRole("checkbox")).toBeEnabled());
    await user.click(within(connectedRow).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /connect now/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));

    // Nothing is being fetched, so the usual reassurance would have the PM
    // waiting for a run that never starts.
    expect(await screen.findByText(/no re-ingestion needed/i)).toBeInTheDocument();
    expect(screen.queryByText(/initial ingestion is running/i)).not.toBeInTheDocument();
    // ...and the row says the same, so the instant completion is not mistaken
    // for the connect having done nothing.
    expect(await screen.findByText(/already available, nothing re-ingested/i)).toBeInTheDocument();
  });

  it("still promises an ingestion for a repository that is genuinely new", async () => {
    server.use(
      discoveryHandler,
      http.post("/api/v1/github/connect", () =>
        HttpResponse.json({ transactionId: "txn-a", wasReused: false }),
      ),
    );

    const user = userEvent.setup();
    const props = renderModal();
    await gotoGithubStep(user);
    await stageRepoA(user);
    await user.click(screen.getByRole("button", { name: /connect 1 source/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));

    expect(await screen.findByText(/initial ingestion is running/i)).toBeInTheDocument();
    expect(screen.queryByText(/no re-ingestion needed/i)).not.toBeInTheDocument();
  });

  it("reports a reuse the backend found for a repository staged as new", async () => {
    // Discovery saw nothing, because the repository was connected by somebody
    // else between the discovery call and this connect.
    server.use(
      discoveryHandler,
      http.post("/api/v1/github/connect", () =>
        HttpResponse.json({ transactionId: "txn-a", wasReused: true }),
      ),
    );

    const user = userEvent.setup();
    const props = renderModal();
    await gotoGithubStep(user);
    await stageRepoA(user);
    await user.click(screen.getByRole("button", { name: /connect 1 source/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));

    expect(await screen.findByText(/no re-ingestion needed/i)).toBeInTheDocument();
  });

  it("stages and connects a newly discovered repository with the right body", async () => {
    let capturedBody: unknown = null;
    server.use(
      discoveryHandler,
      http.post("/api/v1/github/connect", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ transactionId: "txn-a" });
      }),
    );

    const user = userEvent.setup();
    const props = renderModal();
    await gotoGithubStep(user);
    await stageRepoA(user);

    // Staged on the list; the connect button reflects the count.
    expect(screen.getByText("acme/repo-a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /connect 1 source/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalledTimes(1));
    expect(props.onClose).toHaveBeenCalled();
    expect(capturedBody).toEqual({
      owner: "acme",
      name: "repo-a",
      tokenName: "default",
      projectId: "project-1",
    });
  });

  it("keeps a newly added GitHub token visible when the post-add refetch fails", async () => {
    // POST succeeds (token persisted), but the follow-up GET fails. Without the
    // optimistic insert the picker stayed on "no saved tokens" and re-adding
    // the same name hit the backend's duplicate error.
    let added = false;
    server.use(
      http.get("/api/v1/github/pat", () =>
        added ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([]),
      ),
      http.post("/api/v1/github/pat", () => {
        added = true;
        return new HttpResponse(null, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderModal({ tokenNames: [] });
    await gotoGithubStep(user);

    await user.click(screen.getByRole("button", { name: /add github token/i }));
    await user.type(screen.getByTestId("settings-add-token-name"), "fresh-pat");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_secret123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    // The token is adopted into the picker despite the failed reload.
    await waitFor(() =>
      expect(screen.getByLabelText("Access token")).toHaveTextContent("fresh-pat"),
    );
  });

  it("keeps building the list across source types before connecting", async () => {
    server.use(discoveryHandler, jiraCredentialsHandler(["default"]));
    const user = userEvent.setup();
    renderModal();

    // Stage a GitHub repo.
    await gotoGithubStep(user);
    await stageRepoA(user);
    expect(screen.getByText("acme/repo-a")).toBeInTheDocument();

    // Add another source of a different type from the list.
    await user.click(screen.getByRole("button", { name: "Add source" }));
    await user.click(screen.getByRole("button", { name: /jira/i }));
    await user.type(screen.getByTestId("jira-display-name"), "Team board");
    await user.type(screen.getByTestId("jira-instance-url"), "https://acme.atlassian.net");
    await waitFor(() => expect(screen.getByLabelText("Credential")).toHaveTextContent("default"));
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    // Both types now sit in the same list, ready to connect together.
    expect(screen.getByText("acme/repo-a")).toBeInTheDocument();
    expect(screen.getByText("Team board")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect 2 sources/i })).toBeEnabled();
  });

  it("removes a staged source from the list", async () => {
    server.use(discoveryHandler);
    const user = userEvent.setup();
    renderModal();

    await gotoGithubStep(user);
    await stageRepoA(user);
    expect(screen.getByText("acme/repo-a")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove acme\/repo-a/i }));

    // The list is empty again, so it falls back to the type grid for the next add.
    expect(screen.queryByText("acme/repo-a")).not.toBeInTheDocument();
  });

  it("can go back from the GitHub detail screen to the type grid", async () => {
    const user = userEvent.setup();
    renderModal();
    await gotoGithubStep(user);
    expect(screen.getByLabelText("Organization, user, or URL")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to source types/i }));
    // Back on the type grid: the type cards are shown and the discovery input is gone.
    expect(screen.getByRole("button", { name: /jira/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Organization, user, or URL")).not.toBeInTheDocument();
  });

  it("blocks connecting when the user may not ingest into the project", async () => {
    const user = userEvent.setup();
    renderModal({ canIngest: false, ingestBlockedReason: "Not your project." });

    // The reason is stated up front on the type grid.
    expect(screen.getByText("Not your project.")).toBeInTheDocument();

    // On a detail screen, "Connect now" stays disabled.
    await user.click(screen.getByRole("button", { name: /jira/i }));
    expect(screen.getByRole("button", { name: /connect now/i })).toBeDisabled();
  });
});
