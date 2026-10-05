import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  render(<AddSourceModal {...props} />, { wrapper: ToastProvider });
  return props;
}

const pages = [
  {
    id: "page-1",
    title: "Sprint Planning",
    url: "https://www.notion.so/Sprint-Planning-page1",
    lastEditedTime: "2026-03-04T10:00:00Z",
  },
  {
    id: "page-2",
    title: "Retro Notes",
    url: "https://www.notion.so/Retro-Notes-page2",
    lastEditedTime: "2026-03-05T10:00:00Z",
  },
];

const credential = (name: string, workspaceName: string | null = "Acme Workspace") => ({
  name,
  workspaceId: workspaceName ? "ws-1" : null,
  workspaceName,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const NOTION_CARD = /indexes the pages a notion token/i;

/** Opens the Notion detail and waits until the credential is adopted and its preview is listed. */
async function openNotionDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: NOTION_CARD }));
  await screen.findByText("Sprint Planning");
}

describe("AddSourceModal, Notion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(
      http.get("/api/v1/github/pat", () => HttpResponse.json(["default"])),
      http.get("/api/v1/notion/credentials", () => HttpResponse.json([credential("wiki")])),
      http.get("/api/v1/notion/pages", () => HttpResponse.json(pages)),
    );
  });

  it("offers Notion as a connectable source type", () => {
    renderModal();

    expect(screen.getByRole("button", { name: NOTION_CARD })).toBeEnabled();
  });

  it("connects the workspace once against the project", async () => {
    const posted: unknown[] = [];
    server.use(
      http.post("/api/v1/notion/projects/project-1/connections", async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json({ id: `conn-${posted.length}` }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const props = renderModal();

    await openNotionDetail(user);
    await user.click(await screen.findByRole("button", { name: /connect now/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalled());
    expect(posted).toEqual([{ credentialName: "wiki" }]);
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("keeps the footer actions off while there is no credential to connect", async () => {
    server.use(http.get("/api/v1/notion/credentials", () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: NOTION_CARD }));

    expect(await screen.findByText("No credential yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to list/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /connect now/i })).toBeDisabled();
  });

  it("enables the footer actions once the preview has loaded", async () => {
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);

    await waitFor(() => expect(screen.getByRole("button", { name: /add to list/i })).toBeEnabled());
    expect(screen.getByRole("button", { name: /connect now/i })).toBeEnabled();
  });

  it("connects a credential that Notion named no workspace for, under the credential's name", async () => {
    server.use(
      http.get("/api/v1/notion/credentials", () => HttpResponse.json([credential("wiki", null)])),
    );
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);
    await user.click(await screen.findByRole("button", { name: /add to list/i }));

    expect(await screen.findByText(/wiki · 2 pages visible/)).toBeInTheDocument();
  });

  it("stages the workspace with its credential and page count", async () => {
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);
    await user.click(await screen.findByRole("button", { name: /add to list/i }));

    // Back on the staged list, the workspace is listed by its name with the credential and page count.
    expect(await screen.findByText("Acme Workspace")).toBeInTheDocument();
    expect(screen.getByText(/wiki · 2 pages visible/)).toBeInTheDocument();
    expect(screen.getByText(/Not connected yet/)).toBeInTheDocument();
  });

  it("shows a readable failure on the row when the workspace is already connected to the project", async () => {
    server.use(
      http.post("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json({ message: "conflict" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);
    await user.click(await screen.findByRole("button", { name: /connect now/i }));

    expect(
      await screen.findByText(/This Notion workspace is already connected to this project/),
    ).toBeInTheDocument();
  });

  it("marks a credential already connected to this project and blocks adding it", async () => {
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json([
          { id: "conn-1", workspaceName: "Acme Workspace", credentialName: "wiki" },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);

    expect(await screen.findByText("Already in this project.")).toBeVisible();
    expect(screen.getByRole("button", { name: /add to list/i })).toBeDisabled();
  });

  it("adds a Notion credential inline and previews its workspace", async () => {
    let stored: ReturnType<typeof credential>[] = [];
    server.use(
      http.get("/api/v1/notion/credentials", () => HttpResponse.json(stored)),
      http.post("/api/v1/notion/credentials", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        stored = [credential(body.name)];
        return HttpResponse.json(stored[0], { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: NOTION_CARD }));
    await user.click(await screen.findByRole("button", { name: /add notion credential/i }));
    await user.type(screen.getByTestId("settings-notion-add-name"), "wiki");
    await user.type(screen.getByTestId("settings-notion-add-token"), "secret");
    await user.click(screen.getByTestId("settings-notion-add-submit"));

    expect(await screen.findByText("Sprint Planning")).toBeInTheDocument();
    expect(screen.getByLabelText("Notion credential")).toHaveTextContent("wiki");
  });
});
