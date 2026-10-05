import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { http, HttpResponse } from "msw";
import { NotionWorkspacePicker } from "../../../src/features/data-ingestion/connectors/notion/WorkspacePicker";
import { server } from "../setup/vitest.setup";

const credentials = [
  {
    name: "wiki",
    workspaceId: "ws-1",
    workspaceName: "Acme Workspace",
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

function renderPicker(credentialName = "wiki") {
  return render(
    <NotionWorkspacePicker
      credentials={credentials}
      credentialName={credentialName}
      onCredentialNameChange={vi.fn()}
      projectId={null}
      onWorkspaceChange={vi.fn()}
    />,
  );
}

describe("NotionWorkspacePicker accessibility", () => {
  it("has no violations with a workspace card and a page preview", async () => {
    server.use(
      http.get("/api/v1/notion/pages", () =>
        HttpResponse.json([
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
        ]),
      ),
    );

    const { container } = renderPicker();
    await screen.findByText("Sprint Planning");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations in the empty state", async () => {
    server.use(http.get("/api/v1/notion/pages", () => HttpResponse.json([])));

    const { container } = renderPicker();
    await screen.findByText("No pages found");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations when the preview failed", async () => {
    server.use(
      http.get("/api/v1/notion/pages", () => HttpResponse.json({ message: "x" }, { status: 422 })),
    );

    const { container } = renderPicker();
    await screen.findByRole("alert");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations for a credential without a recorded workspace", async () => {
    server.use(http.get("/api/v1/notion/pages", () => HttpResponse.json([])));

    const { container } = renderPicker("legacy");
    await screen.findByText("No pages found");

    expect(await axe(container)).toHaveNoViolations();
  });
});
