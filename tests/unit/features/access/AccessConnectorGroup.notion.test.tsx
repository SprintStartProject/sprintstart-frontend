import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AccessConnectorGroup } from "../../../../src/features/access/components/AccessConnectorGroup";
import { ACCESS_CONNECTORS, notionConnector } from "../../../../src/features/access/registry";
import type { NotionCredentialDto } from "../../../../src/services/sources/notionService";

vi.mock("../../../../src/services/sources/notionService", () => ({
  getMyNotionCredentials: vi.fn(),
  addNotionCredential: vi.fn(),
  changeNotionCredentialName: vi.fn(),
  changeNotionCredentialToken: vi.fn(),
  deleteNotionCredential: vi.fn(),
}));

import {
  getMyNotionCredentials,
  addNotionCredential,
  deleteNotionCredential,
} from "../../../../src/services/sources/notionService";

const cred = (name: string): NotionCredentialDto => ({
  name,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

/** Stable identity, so the group's report effect does not re-run every render. */
const noop = () => {};

function GroupHarness() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsAddOpen(true)}>
        open add form
      </button>
      <AccessConnectorGroup
        connector={notionConnector}
        isHidden={false}
        isAddOpen={isAddOpen}
        onAddClose={() => setIsAddOpen(false)}
        onStateChange={noop}
      />
    </>
  );
}

function renderGroup() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <GroupHarness />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("access registry — Notion", () => {
  it("lists Notion after GitHub and Atlassian", () => {
    expect(ACCESS_CONNECTORS.map((connector) => connector.id)).toEqual([
      "github",
      "atlassian",
      "notion",
    ]);
    expect(notionConnector.label).toBe("Notion");
  });
});

describe("AccessConnectorGroup — Notion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyNotionCredentials).mockResolvedValue([cred("wiki")]);
    vi.mocked(addNotionCredential).mockResolvedValue(undefined);
    vi.mocked(deleteNotionCredential).mockResolvedValue(undefined);
  });

  it("renders the credentials keyed by name", async () => {
    vi.mocked(getMyNotionCredentials).mockResolvedValue([cred("wiki"), cred("docs")]);

    renderGroup();

    expect(await screen.findByText("wiki")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("2 credentials")).toBeInTheDocument();
  });

  it("shows the empty state with the sharing hint", async () => {
    vi.mocked(getMyNotionCredentials).mockResolvedValue([]);

    renderGroup();

    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
    expect(screen.getByText(/Share each page with the integration/i)).toBeInTheDocument();
  });

  it("adds a credential and shows it in the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyNotionCredentials)
      .mockResolvedValueOnce([cred("wiki")])
      .mockResolvedValueOnce([cred("wiki"), cred("docs")]);

    renderGroup();
    await screen.findByText("wiki");

    await user.click(screen.getByRole("button", { name: "open add form" }));
    await user.type(screen.getByTestId("settings-notion-add-name"), "docs");
    await user.type(screen.getByTestId("settings-notion-add-token"), "secret");
    await user.click(screen.getByTestId("settings-notion-add-submit"));

    await waitFor(() =>
      expect(addNotionCredential).toHaveBeenCalledWith({ name: "docs", token: "secret" }),
    );
    expect(await screen.findByText("2 credentials")).toBeInTheDocument();
  });

  it("deletes a credential and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyNotionCredentials)
      .mockResolvedValueOnce([cred("wiki")])
      .mockResolvedValueOnce([]);

    renderGroup();
    await screen.findByText("wiki");

    await user.click(screen.getByTestId("settings-notion-delete-open-wiki"));
    await user.click(screen.getByTestId("settings-notion-delete-confirm-wiki"));

    await waitFor(() => expect(deleteNotionCredential).toHaveBeenCalledWith({ name: "wiki" }));
    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
  });
});
