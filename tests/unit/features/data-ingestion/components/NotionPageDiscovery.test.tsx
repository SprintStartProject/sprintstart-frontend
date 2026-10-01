import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  NotionPageDiscovery,
  type NotionPageSelection,
} from "../../../../../src/features/data-ingestion/components/NotionPageDiscovery";
import type { NotionCredentialDto } from "../../../../../src/services/sources/notionService";
import { server } from "../../../setup/vitest.setup";

const credentials: NotionCredentialDto[] = [
  { name: "wiki", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { name: "docs", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

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
  {
    id: "page-3",
    title: "Onboarding",
    url: "https://www.notion.so/Onboarding-page3",
    lastEditedTime: "2026-03-05T10:00:00Z",
  },
];

function pagesHandler(byCredential: Record<string, unknown[]> = { wiki: pages }) {
  return http.get("/api/v1/notion/pages", ({ request }) => {
    const credentialName = new URL(request.url).searchParams.get("credentialName") ?? "";
    return HttpResponse.json(byCredential[credentialName] ?? []);
  });
}

type HarnessProps = {
  projectId?: string | null;
  stagedPageIds?: string[];
  onSelection?: (selection: NotionPageSelection[]) => void;
};

const NO_STAGED: string[] = [];

function Harness({ projectId = null, stagedPageIds = NO_STAGED, onSelection }: HarnessProps) {
  const [credentialName, setCredentialName] = useState("wiki");
  const [selection, setSelection] = useState<NotionPageSelection[]>([]);

  return (
    <>
      <NotionPageDiscovery
        credentials={credentials}
        credentialName={credentialName}
        onCredentialNameChange={setCredentialName}
        projectId={projectId}
        stagedPageIds={stagedPageIds}
        onSelectionChange={(next) => {
          setSelection(next);
          onSelection?.(next);
        }}
      />
      <output data-testid="selection">{selection.map((page) => page.pageId).join(",")}</output>
    </>
  );
}

const rowOf = (title: string) => screen.getByText(title).closest("label") as HTMLElement;

describe("NotionPageDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(pagesHandler());
  });

  it("lists the pages of the selected credential with title, edit date and a link", async () => {
    render(<Harness />);

    expect(await screen.findByText("Sprint Planning")).toBeInTheDocument();
    expect(screen.getByText("Retro Notes")).toBeInTheDocument();
    expect(within(rowOf("Sprint Planning")).getByText(/^Edited /)).toBeInTheDocument();
    // A page that was never edited shows no date instead of "Invalid Date".
    expect(within(rowOf("Retro Notes")).queryByText(/^Edited /)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Sprint Planning in Notion" })).toHaveAttribute(
      "href",
      "https://www.notion.so/Sprint-Planning-page1",
    );
  });

  it("filters the pages by title", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Sprint Planning");

    await user.type(screen.getByLabelText("Filter pages"), "retro");

    expect(screen.getByText("Retro Notes")).toBeInTheDocument();
    expect(screen.queryByText("Sprint Planning")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Filter pages"));
    await user.type(screen.getByLabelText("Filter pages"), "zzz");
    expect(screen.getByText("No page matches this filter.")).toBeInTheDocument();
  });

  it("reports several ticked pages and counts them", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Sprint Planning");

    await user.click(within(rowOf("Sprint Planning")).getByRole("checkbox"));
    await user.click(within(rowOf("Onboarding")).getByRole("checkbox"));

    expect(screen.getByTestId("selection")).toHaveTextContent("page-1,page-3");
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(within(rowOf("Sprint Planning")).getByRole("checkbox"));
    expect(screen.getByTestId("selection")).toHaveTextContent("page-3");
  });

  it("selects and clears every visible page", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Sprint Planning");

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("page-1,page-2,page-3");

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("");
  });

  it("hands up the title and url of a ticked page", async () => {
    const user = userEvent.setup();
    const onSelection = vi.fn();
    render(<Harness onSelection={onSelection} />);
    await screen.findByText("Retro Notes");

    await user.click(within(rowOf("Retro Notes")).getByRole("checkbox"));

    expect(onSelection).toHaveBeenLastCalledWith([
      { pageId: "page-2", title: "Retro Notes", url: "https://www.notion.so/Retro-Notes-page2" },
    ]);
  });

  it("marks pages already connected to the project and cannot tick them", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json([{ id: "conn-1", pageId: "page-1" }]),
      ),
    );
    render(<Harness projectId="project-1" />);
    await screen.findByText("Sprint Planning");

    const connectedRow = rowOf("Sprint Planning");
    await waitFor(() => expect(within(connectedRow).getByText("In this project")).toBeVisible());
    expect(within(connectedRow).getByRole("checkbox")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("page-2,page-3");
  });

  it("marks pages staged in the parent's list and cannot tick them", async () => {
    render(<Harness stagedPageIds={["page-3"]} />);
    await screen.findByText("Onboarding");

    expect(within(rowOf("Onboarding")).getByText("In your list")).toBeVisible();
    expect(within(rowOf("Onboarding")).getByRole("checkbox")).toBeDisabled();
  });

  it("still works when the project's connections cannot be read", async () => {
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    render(<Harness projectId="project-1" />);

    expect(await screen.findByText("Sprint Planning")).toBeInTheDocument();
    expect(within(rowOf("Sprint Planning")).getByRole("checkbox")).toBeEnabled();
  });

  it("explains how to share pages when the integration sees none", async () => {
    server.use(pagesHandler({ wiki: [] }));
    render(<Harness />);

    expect(await screen.findByText("No pages found")).toBeInTheDocument();
    expect(screen.getByText(/shared with the integration/i)).toBeInTheDocument();
  });

  it.each([
    [401, /rejected this token/i],
    [502, /could not be reached/i],
  ])("shows a readable message on %i", async (status, message) => {
    server.use(
      http.get("/api/v1/notion/pages", () => HttpResponse.json({ message: "x" }, { status })),
    );
    render(<Harness />);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("reloads the pages on request", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get("/api/v1/notion/pages", () => {
        calls += 1;
        return HttpResponse.json(calls === 1 ? [pages[0]] : pages);
      }),
    );
    render(<Harness />);
    await screen.findByText("Sprint Planning");
    expect(screen.queryByText("Onboarding")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload pages" }));

    expect(await screen.findByText("Onboarding")).toBeInTheDocument();
  });

  it("drops a ticked page when another credential does not return it", async () => {
    const user = userEvent.setup();
    server.use(pagesHandler({ wiki: pages, docs: [pages[1]] }));
    render(<Harness />);
    await screen.findByText("Sprint Planning");

    await user.click(within(rowOf("Sprint Planning")).getByRole("checkbox"));
    expect(screen.getByTestId("selection")).toHaveTextContent("page-1");

    await user.click(screen.getByLabelText("Notion credential"));
    await user.click(await screen.findByRole("option", { name: "docs" }));

    await screen.findByText("Retro Notes");
    expect(screen.queryByText("Sprint Planning")).not.toBeInTheDocument();
    expect(screen.getByTestId("selection")).toHaveTextContent("");
  });
});
