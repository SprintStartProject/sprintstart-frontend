import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { ConnectorSourcesSection } from "../../../../src/features/connectors/components/ConnectorSourcesSection";
import { GitBranch } from "lucide-react";
import type { ConnectorListItem } from "../../../../src/features/connectors/types";

/**
 * Save outcomes are surfaced as toasts now, so each render is wrapped in a
 * ToastProvider — without it `useToast` no-ops and nothing would mount.
 */
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

const connector: ConnectorListItem = {
  id: "github",
  name: "Github Repository Connector",
  enabled: true,
  firstConfiguredAt: null,
  lastConfiguredAt: null,
  meta: {
    label: "GitHub Repository Connector",
    description: "Repositories connected via GitHub.",
    icon: GitBranch,
  },
};

const baseSource = {
  id: "org/repo",
  name: "org/repo",
  url: "https://github.com/org/repo",
  enabled: true,
};

describe("ConnectorSourcesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get("/api/v1/connectors/github/sources", () =>
        HttpResponse.json({ connectorId: "github", sources: [baseSource] }),
      ),
    );
  });

  it("renders sources and toggles a pending change", async () => {
    const user = userEvent.setup();

    render(<ConnectorSourcesSection connector={connector} />);

    await waitFor(() => {
      expect(screen.getByText("org/repo")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /exclude org\/repo/i }));

    expect(screen.getByRole("button", { name: /save 1 change/i })).toBeInTheDocument();
  });

  it("shows a soft warning (not a hard error) when the save fails but the change is confirmed to have persisted", async () => {
    const user = userEvent.setup();

    server.use(
      http.patch("/api/v1/connectors/github/sources/status", () =>
        HttpResponse.json(
          {
            timestamp: "2026-01-01T00:00:00Z",
            status: 500,
            error: "Internal Server Error",
            path: "/api/v1/connectors/github/sources/status",
          },
          { status: 500 },
        ),
      ),
    );

    render(<ConnectorSourcesSection connector={connector} />);

    await waitFor(() => {
      expect(screen.getByText("org/repo")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /exclude org\/repo/i }));

    server.use(
      http.get("/api/v1/connectors/github/sources", () =>
        HttpResponse.json({
          connectorId: "github",
          sources: [{ ...baseSource, enabled: false }],
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /save 1 change/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Confirming the change with the AI service failed/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /include org\/repo/i })).toBeInTheDocument();
  });

  it("shows a hard error when the save fails and the refetched state does not match the intended change", async () => {
    const user = userEvent.setup();

    server.use(
      http.patch("/api/v1/connectors/github/sources/status", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    render(<ConnectorSourcesSection connector={connector} />);

    await waitFor(() => {
      expect(screen.getByText("org/repo")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /exclude org\/repo/i }));

    server.use(
      http.get("/api/v1/connectors/github/sources", () =>
        HttpResponse.json({ connectorId: "github", sources: [baseSource] }),
      ),
    );

    await user.click(screen.getByRole("button", { name: /save 1 change/i }));

    await waitFor(() => {
      expect(screen.getByText(/boom/)).toBeInTheDocument();
    });
  });

  it("falls back to a plain error when both the save and the reconciliation refetch fail", async () => {
    const user = userEvent.setup();

    server.use(
      http.patch("/api/v1/connectors/github/sources/status", () =>
        HttpResponse.json({ message: "save failed" }, { status: 500 }),
      ),
    );

    render(<ConnectorSourcesSection connector={connector} />);

    await waitFor(() => {
      expect(screen.getByText("org/repo")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /exclude org\/repo/i }));

    server.use(http.get("/api/v1/connectors/github/sources", () => HttpResponse.error()));

    await user.click(screen.getByRole("button", { name: /save 1 change/i }));

    await waitFor(() => {
      expect(screen.getByText(/save failed/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /save 1 change/i })).toBeInTheDocument();
  });

  it("offers a Confluence space the same include/exclude toggle as any other source", async () => {
    const user = userEvent.setup();
    const confluenceConnector: ConnectorListItem = {
      ...connector,
      id: "confluence",
      name: "Confluence Cloud Connector",
      meta: {
        label: "Confluence Cloud Connector",
        description: "Pages and spaces from connected Confluence Cloud tenants.",
        icon: GitBranch,
      },
    };

    const space = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Engineering",
      url: "https://acme.atlassian.net/wiki/spaces/ENG",
      enabled: true,
    };
    let patchUrl: string | null = null;

    server.use(
      http.get("/api/v1/connectors/confluence/sources", () =>
        HttpResponse.json({ connectorId: "confluence", sources: [space] }),
      ),
      http.patch("/api/v1/connectors/confluence/sources/status", ({ request }) => {
        patchUrl = request.url;

        return HttpResponse.json({
          connectorId: "confluence",
          sources: [{ ...space, enabled: false }],
        });
      }),
    );

    render(<ConnectorSourcesSection connector={confluenceConnector} projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Engineering")).toBeInTheDocument();
    });

    // Enabling and disabling is all this modal does — no connecting, no syncing.
    expect(screen.queryByRole("button", { name: /add space/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sync now/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /exclude engineering/i }));
    await user.click(screen.getByRole("button", { name: /save 1 change/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /include engineering/i })).toBeInTheDocument();
    });

    // Confluence sources belong to one project, so the backend rejects a patch
    // that does not name it.
    expect(patchUrl).toContain("projectId=proj-1");
  });
});
