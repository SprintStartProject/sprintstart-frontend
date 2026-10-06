import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  NotionWorkspacePicker,
  type NotionWorkspaceSelection,
} from "../../../../../src/features/data-ingestion/connectors/notion/WorkspacePicker";
import type { NotionCredentialDto } from "../../../../../src/services/sources/notionService";
import { server } from "../../../setup/vitest.setup";

const credentials: NotionCredentialDto[] = [
  {
    name: "wiki",
    workspaceId: "ws-1",
    workspaceName: "Acme Workspace",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    name: "docs",
    workspaceId: "ws-2",
    workspaceName: "Docs Workspace",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    name: "legacy",
    workspaceId: null,
    workspaceName: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
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
    lastEditedTime: "",
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
  initialCredential?: string;
  projectId?: string | null;
  onWorkspace?: (selection: NotionWorkspaceSelection | null) => void;
};

function Harness({ initialCredential = "wiki", projectId = null, onWorkspace }: HarnessProps) {
  const [credentialName, setCredentialName] = useState(initialCredential);
  const [selection, setSelection] = useState<NotionWorkspaceSelection | null>(null);

  return (
    <>
      <NotionWorkspacePicker
        credentials={credentials}
        credentialName={credentialName}
        onCredentialNameChange={setCredentialName}
        projectId={projectId}
        onWorkspaceChange={(next) => {
          setSelection(next);
          onWorkspace?.(next);
        }}
      />
      <output data-testid="selection">
        {selection ? `${selection.workspaceName}:${selection.pageCount}` : "none"}
      </output>
    </>
  );
}

const rowOf = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

describe("NotionWorkspacePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.use(pagesHandler());
  });

  it("previews the pages of the selected credential with title, edit date and a link", async () => {
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

  it("is read-only: there is nothing to tick", async () => {
    render(<Harness />);
    await screen.findByText("Sprint Planning");

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();
  });

  it("shows the workspace card with the number of shared pages", async () => {
    render(<Harness />);

    expect(await screen.findByText("3 pages visible")).toBeInTheDocument();
    expect(screen.getByText("Acme Workspace")).toBeInTheDocument();
  });

  it("labels the credentials with their workspace", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Notion credential")).toHaveTextContent("wiki · Acme Workspace");
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

  it("hands up the credential, workspace and page count once the preview has loaded", async () => {
    const onWorkspace = vi.fn();
    render(<Harness onWorkspace={onWorkspace} />);

    await waitFor(() =>
      expect(onWorkspace).toHaveBeenLastCalledWith({
        credentialName: "wiki",
        workspaceName: "Acme Workspace",
        pageCount: 3,
      }),
    );
    // Nothing connectable before the preview answered.
    expect(onWorkspace).toHaveBeenNthCalledWith(1, null);
  });

  it("follows the credential when another one is picked", async () => {
    const user = userEvent.setup();
    server.use(pagesHandler({ wiki: pages, docs: [pages[1]] }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("Acme"));

    await user.click(screen.getByLabelText("Notion credential"));
    await user.click(await screen.findByRole("option", { name: "docs · Docs Workspace" }));

    await screen.findByText("1 page visible");
    expect(screen.queryByText("Sprint Planning")).not.toBeInTheDocument();
    expect(screen.getByTestId("selection")).toHaveTextContent("Docs Workspace:1");
  });

  it("names the connection after the credential when Notion named no workspace", async () => {
    server.use(pagesHandler({ legacy: pages }));
    render(<Harness initialCredential="legacy" />);

    await screen.findByText("Sprint Planning");
    // Once in the credential dropdown and once on the workspace card.
    expect(screen.getAllByText("legacy")).toHaveLength(2);
    expect(screen.getByTestId("selection")).toHaveTextContent("legacy:3");
  });

  it("flags a credential already connected to the project and blocks adding it", async () => {
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json([
          { id: "conn-1", workspaceName: "Acme Workspace", credentialName: "wiki" },
        ]),
      ),
    );
    render(<Harness projectId="project-1" />);
    await screen.findByText("Sprint Planning");

    expect(await screen.findByText("Already in this project.")).toBeVisible();
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("allows another credential than the ones the project already uses", async () => {
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json([
          { id: "conn-1", workspaceName: "Docs Workspace", credentialName: "docs" },
        ]),
      ),
    );
    render(<Harness projectId="project-1" />);

    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("Acme"));
    expect(screen.queryByText("Already in this project.")).not.toBeInTheDocument();
  });

  it("still works when the project's connections cannot be read", async () => {
    server.use(
      http.get("/api/v1/notion/projects/project-1/connections", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    render(<Harness projectId="project-1" />);

    expect(await screen.findByText("Sprint Planning")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("Acme"));
  });

  it("explains how to share pages when the token sees none", async () => {
    server.use(pagesHandler({ wiki: [] }));
    render(<Harness />);

    expect(await screen.findByText("No pages found")).toBeInTheDocument();
    expect(screen.getByText(/shared with the token/i)).toBeInTheDocument();
    expect(screen.getByText("0 pages visible")).toBeInTheDocument();
  });

  it("passes the readable server message through on a 422 and blocks adding", async () => {
    server.use(
      http.get("/api/v1/notion/pages", () =>
        HttpResponse.json(
          { message: "Notion rejected this token.", code: "NOTION_AUTHENTICATION_FAILED" },
          { status: 422 },
        ),
      ),
    );
    render(<Harness />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Notion rejected this token.");
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("shows a readable message when Notion cannot be reached", async () => {
    server.use(
      http.get("/api/v1/notion/pages", () => HttpResponse.json({ message: "x" }, { status: 502 })),
    );
    render(<Harness />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be reached/i);
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
    expect(screen.getByText("3 pages visible")).toBeInTheDocument();
  });
});
