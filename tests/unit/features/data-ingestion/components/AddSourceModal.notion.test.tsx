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
    lastEditedTime: null,
  },
];

const credential = (name: string) => ({
  name,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const rowOf = (title: string) => screen.getByText(title).closest("label") as HTMLElement;

/** Opens the Notion detail and waits until the credential is adopted and its pages are listed. */
async function openNotionDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /indexes pages that were shared/i }));
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

  it("offers Notion as an available source type", () => {
    renderModal();

    const card = screen.getByRole("button", { name: /indexes pages that were shared/i });
    expect(within(card).queryByText("Soon")).not.toBeInTheDocument();
  });

  it("connects every ticked page on its own against the project", async () => {
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
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: /connect now/i }));

    await waitFor(() => expect(props.onConnected).toHaveBeenCalled());
    expect(posted).toEqual([
      { credentialName: "wiki", pageId: "page-1" },
      { credentialName: "wiki", pageId: "page-2" },
    ]);
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("keeps the footer actions off until a page is ticked", async () => {
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);

    expect(screen.getByRole("button", { name: /add to list/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /connect now/i })).toBeDisabled();

    await user.click(within(rowOf("Sprint Planning")).getByRole("checkbox"));

    expect(screen.getByRole("button", { name: /add to list/i })).toBeEnabled();
  });

  it("stages the ticked pages and marks them as taken when adding more", async () => {
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);
    await user.click(within(rowOf("Sprint Planning")).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    // Back on the staged list, the page is listed by its title.
    expect(await screen.findByText("Sprint Planning")).toBeInTheDocument();
    expect(screen.getByText(/Not connected yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^add source$/i }));
    await user.click(screen.getByRole("button", { name: /indexes pages that were shared/i }));
    await screen.findByText("Retro Notes");

    expect(within(rowOf("Sprint Planning")).getByText("In your list")).toBeVisible();
    expect(within(rowOf("Sprint Planning")).getByRole("checkbox")).toBeDisabled();
  });

  it("shows a readable failure on the row when the page belongs to a project already", async () => {
    server.use(
      http.post("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json({ message: "conflict" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);
    await user.click(within(rowOf("Sprint Planning")).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /connect now/i }));

    expect(
      await screen.findByText(/This Notion page is already connected to a project/),
    ).toBeInTheDocument();
  });

  it("marks pages already connected to this project", async () => {
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json([{ id: "conn-1", pageId: "page-2" }]),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await openNotionDetail(user);

    await waitFor(() =>
      expect(within(rowOf("Retro Notes")).getByText("In this project")).toBeVisible(),
    );
    expect(within(rowOf("Retro Notes")).getByRole("checkbox")).toBeDisabled();
  });

  it("adds a Notion credential inline and lists its pages", async () => {
    let stored: ReturnType<typeof credential>[] = [];
    server.use(
      http.get("/api/v1/notion/credentials", () => HttpResponse.json(stored)),
      http.post("/api/v1/notion/credentials", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        stored = [credential(body.name)];
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /indexes pages that were shared/i }));
    await user.click(await screen.findByRole("button", { name: /add notion credential/i }));
    await user.type(screen.getByTestId("settings-notion-add-name"), "wiki");
    await user.type(screen.getByTestId("settings-notion-add-token"), "secret");
    await user.click(screen.getByTestId("settings-notion-add-submit"));

    expect(await screen.findByText("Sprint Planning")).toBeInTheDocument();
    expect(screen.getByLabelText("Notion credential")).toHaveTextContent("wiki");
  });
});
