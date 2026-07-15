import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { ConnectorSourcesSection } from "../../../../src/features/connectors/components/ConnectorSourcesSection";
import { GitBranch } from "lucide-react";
import type { ConnectorListItem } from "../../../../src/features/connectors/types";

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

    await user.click(
      screen.getByRole("button", { name: /exclude org\/repo/i }),
    );

    expect(
      screen.getByRole("button", { name: /save 1 change/i }),
    ).toBeInTheDocument();
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

    await user.click(
      screen.getByRole("button", { name: /exclude org\/repo/i }),
    );

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
        screen.getByText(/Sources were updated, but confirming the change/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /include org\/repo/i }),
    ).toBeInTheDocument();
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

    await user.click(
      screen.getByRole("button", { name: /exclude org\/repo/i }),
    );

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

    await user.click(
      screen.getByRole("button", { name: /exclude org\/repo/i }),
    );

    server.use(
      http.get("/api/v1/connectors/github/sources", () => HttpResponse.error()),
    );

    await user.click(screen.getByRole("button", { name: /save 1 change/i }));

    await waitFor(() => {
      expect(screen.getByText(/save failed/)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /save 1 change/i }),
    ).toBeInTheDocument();
  });
});
