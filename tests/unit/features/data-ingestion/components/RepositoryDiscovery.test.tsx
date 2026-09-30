import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  RepositoryDiscovery,
  type DiscoveredRepositoryItem,
  type DiscoverySelection,
  type RepositoryDiscoveryAdapter,
} from "../../../../../src/features/data-ingestion/components/RepositoryDiscovery";
import { server } from "../../../setup/vitest.setup";

function repo(
  name: string,
  overrides: Partial<DiscoveredRepositoryItem> = {},
): DiscoveredRepositoryItem {
  return {
    name,
    isPrivate: false,
    url: `https://example.test/acme/${name}`,
    alreadyConnected: false,
    isEnabled: null,
    ...overrides,
  };
}

function makeAdapter(
  overrides: Partial<RepositoryDiscoveryAdapter> = {},
): RepositoryDiscoveryAdapter {
  return {
    sourceSystem: "BITBUCKET",
    providerName: "Bitbucket",
    discover: vi.fn().mockResolvedValue({ repositories: [], hasMore: false }),
    parseInput: (value) => {
      const [owner, name] = value.trim().split("/");
      return owner ? { owner, name: name ?? null } : null;
    },
    ownerLabel: "Workspace",
    ownerPlaceholder: "acme",
    invalidInputMessage: "Enter a workspace.",
    credentialRequiredMessage: "Choose a credential.",
    missingCredentialNotice: "Add a credential first.",
    emptyResultHint: "Nothing here.",
    ...overrides,
  };
}

const statusRow = (sourceSystem: string, fullName: string, repositoryId: string) => ({
  sourceSystem,
  sourceId: fullName,
  repositoryId,
  owner: fullName.split("/")[0],
  name: fullName.split("/")[1],
  sourceUrl: `https://example.test/${fullName}`,
  connectionStatus: "CONNECTED",
  enabled: true,
  artifactCount: 1,
});

function renderDiscovery(
  adapter: RepositoryDiscoveryAdapter,
  props: Partial<Parameters<typeof RepositoryDiscovery>[0]> = {},
) {
  const onSelectionChange = vi.fn<(selection: DiscoverySelection[]) => void>();

  render(
    <RepositoryDiscovery
      adapter={adapter}
      hasCredentials
      credentialName="cred"
      renderCredentialPicker={({ disabled }) => (
        <button type="button" disabled={disabled}>
          picker
        </button>
      )}
      projectId="project-1"
      onSelectionChange={onSelectionChange}
      {...props}
    />,
  );

  return { onSelectionChange };
}

async function discover(user: ReturnType<typeof userEvent.setup>, value = "acme") {
  await user.type(screen.getByLabelText(/workspace/i), value);
  await user.click(screen.getByRole("button", { name: /discover/i }));
}

function lastSelection(onSelectionChange: ReturnType<typeof vi.fn>): DiscoverySelection[] {
  const calls = onSelectionChange.mock.calls;
  return calls[calls.length - 1][0] as DiscoverySelection[];
}

describe("RepositoryDiscovery", () => {
  it("shows the adapter's labels and the credential picker slot", () => {
    renderDiscovery(makeAdapter());

    expect(screen.getByLabelText("Workspace")).toHaveAttribute("placeholder", "acme");
    expect(screen.getByRole("button", { name: "picker" })).toBeEnabled();
  });

  it("shows the missing-credential notice and locks the form without credentials", () => {
    renderDiscovery(makeAdapter(), { hasCredentials: false });

    expect(screen.getByText("Add a credential first.")).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace")).toBeDisabled();
    expect(screen.getByRole("button", { name: "picker" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discover/i })).toBeDisabled();
  });

  it("hides the notice when the parent shows its own", () => {
    renderDiscovery(makeAdapter(), {
      hasCredentials: false,
      suppressMissingCredentialNotice: true,
    });

    expect(screen.queryByText("Add a credential first.")).not.toBeInTheDocument();
  });

  it("reports the adapter's message when the input has no owner", async () => {
    const adapter = makeAdapter({ parseInput: () => null });
    renderDiscovery(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Workspace"), "x");
    await user.click(screen.getByRole("button", { name: /discover/i }));

    expect(await screen.findByText("Enter a workspace.")).toBeInTheDocument();
    expect(adapter.discover).not.toHaveBeenCalled();
  });

  it("asks for a credential before discovering", async () => {
    const adapter = makeAdapter();
    renderDiscovery(adapter, { credentialName: " " });

    await discover(userEvent.setup());

    expect(await screen.findByText("Choose a credential.")).toBeInTheDocument();
    expect(adapter.discover).not.toHaveBeenCalled();
  });

  it("discovers with the parsed owner, credential and a 0-based first page", async () => {
    const adapter = makeAdapter({
      discover: vi.fn().mockResolvedValue({ repositories: [repo("widgets")], hasMore: false }),
    });
    renderDiscovery(adapter);

    await discover(userEvent.setup(), "acme");

    expect(await screen.findByText("widgets")).toBeInTheDocument();
    expect(adapter.discover).toHaveBeenCalledWith("acme", "cred", 0, 20);
  });

  it("isolates the named repository when the input carries one", async () => {
    const adapter = makeAdapter({
      discover: vi
        .fn()
        .mockResolvedValue({ repositories: [repo("widgets"), repo("gadgets")], hasMore: false }),
    });
    renderDiscovery(adapter);

    await discover(userEvent.setup(), "acme/widgets");

    expect(await screen.findByText("widgets")).toBeInTheDocument();
    expect(screen.queryByText("gadgets")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filter repositories")).toHaveValue("widgets");
  });

  it("loads the next page and appends it when there may be more", async () => {
    const discoverPage = vi
      .fn()
      .mockResolvedValueOnce({ repositories: [repo("a")], hasMore: true })
      .mockResolvedValueOnce({ repositories: [repo("b")], hasMore: false });
    renderDiscovery(makeAdapter({ discover: discoverPage }));
    const user = userEvent.setup();

    await discover(user);
    await user.click(await screen.findByRole("button", { name: /load more/i }));

    expect(await screen.findByText("b")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(discoverPage).toHaveBeenLastCalledWith("acme", "cred", 1, 20);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows the label instead of the name and filters by either", async () => {
    const adapter = makeAdapter({
      discover: vi.fn().mockResolvedValue({
        repositories: [
          repo("widgets-repo", { label: "Widgets" }),
          repo("gadgets-repo", { label: "Gadgets" }),
        ],
        hasMore: false,
      }),
    });
    renderDiscovery(adapter);
    const user = userEvent.setup();

    await discover(user);
    expect(await screen.findByText("Widgets")).toBeInTheDocument();
    expect(screen.queryByText("widgets-repo")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Filter repositories"), "gadgets-r");
    expect(screen.queryByText("Widgets")).not.toBeInTheDocument();
    expect(screen.getByText("Gadgets")).toBeInTheDocument();
  });

  it("omits the external link when a repository has no url", async () => {
    const adapter = makeAdapter({
      discover: vi.fn().mockResolvedValue({
        repositories: [repo("linked"), repo("unlinked", { url: null })],
        hasMore: false,
      }),
    });
    renderDiscovery(adapter);

    await discover(userEvent.setup());

    await screen.findByText("unlinked");
    expect(screen.getByRole("link", { name: "Open linked on Bitbucket" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open unlinked/i })).not.toBeInTheDocument();
  });

  it("uses the adapter's error wording and falls back to the error message", async () => {
    const describeError = vi
      .fn<(error: unknown, owner: string) => string | null>()
      .mockReturnValueOnce("No workspace acme.")
      .mockReturnValueOnce(null);
    const adapter = makeAdapter({
      discover: vi.fn().mockRejectedValue(new Error("boom")),
      describeError,
    });
    renderDiscovery(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Workspace"), "acme");
    await user.click(screen.getByRole("button", { name: /discover/i }));
    expect(await screen.findByText("No workspace acme.")).toBeInTheDocument();
    expect(describeError).toHaveBeenCalledWith(expect.any(Error), "acme");

    await user.click(screen.getByRole("button", { name: /discover/i }));
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("shows the adapter's empty-state hint when nothing is found", async () => {
    renderDiscovery(makeAdapter());

    await discover(userEvent.setup());

    expect(await screen.findByText("No repositories found")).toBeInTheDocument();
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  describe("link state", () => {
    const discoverAlreadyConnected = () =>
      vi.fn().mockResolvedValue({
        repositories: [repo("widgets", { alreadyConnected: true, isEnabled: true })],
        hasMore: false,
      });

    it("makes a repository ingested elsewhere linkable and hands its id to the selection", async () => {
      server.use(
        http.get("/api/v1/ingestion-sources/status", ({ request }) =>
          HttpResponse.json(
            new URL(request.url).searchParams.get("projectId")
              ? []
              : [statusRow("BITBUCKET", "acme/widgets", "bb-1")],
          ),
        ),
      );
      const { onSelectionChange } = renderDiscovery(
        makeAdapter({ discover: discoverAlreadyConnected() }),
      );
      const user = userEvent.setup();

      await discover(user);
      expect(await screen.findByText("Already ingested")).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox"));

      await waitFor(() => {
        expect(lastSelection(onSelectionChange)).toEqual([
          {
            owner: "acme",
            name: "widgets",
            isPrivate: false,
            linkState: "linkable",
            repositoryId: "bb-1",
          },
        ]);
      });
    });

    it("ignores ingestion rows of another source system with the same owner/name", async () => {
      // A GitHub repository acme/widgets must not make the Bitbucket acme/widgets linkable.
      server.use(
        // Answers both the global and the project-scoped request.
        http.get("/api/v1/ingestion-sources/status", () =>
          HttpResponse.json([statusRow("GITHUB", "acme/widgets", "gh-1")]),
        ),
      );
      renderDiscovery(makeAdapter({ discover: discoverAlreadyConnected() }));

      await discover(userEvent.setup());

      // Ingested elsewhere, but no Bitbucket row resolves it, and the GitHub row
      // does not count as "in this project" either.
      expect(await screen.findByText("Connected")).toBeInTheDocument();
      expect(screen.queryByText("Already ingested")).not.toBeInTheDocument();
      expect(screen.queryByText("In this project")).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("marks a repository already in this project and keeps it unselectable", async () => {
      server.use(
        http.get("/api/v1/ingestion-sources/status", () =>
          HttpResponse.json([statusRow("BITBUCKET", "acme/widgets", "bb-1")]),
        ),
      );
      renderDiscovery(makeAdapter({ discover: discoverAlreadyConnected() }));

      await discover(userEvent.setup());

      expect(await screen.findByText("In this project")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });

    it("treats a row without a system label as GitHub", async () => {
      server.use(
        http.get("/api/v1/ingestion-sources/status", () =>
          HttpResponse.json([
            { sourceId: "acme/widgets", repositoryId: "gh-1", connectionStatus: "CONNECTED" },
          ]),
        ),
      );
      const github = makeAdapter({
        sourceSystem: "GITHUB",
        providerName: "GitHub",
        discover: discoverAlreadyConnected(),
      });
      renderDiscovery(github, { projectId: null });

      await discover(userEvent.setup());

      expect(await screen.findByText("Already ingested")).toBeInTheDocument();
    });
  });
});
