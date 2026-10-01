import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { http, HttpResponse } from "msw";
import { NotionPageDiscovery } from "../../../src/features/data-ingestion/components/NotionPageDiscovery";
import { server } from "../setup/vitest.setup";

const credentials = [
  { name: "wiki", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

function renderDiscovery() {
  return render(
    <NotionPageDiscovery
      credentials={credentials}
      credentialName="wiki"
      onCredentialNameChange={vi.fn()}
      projectId={null}
      onSelectionChange={vi.fn()}
    />,
  );
}

describe("NotionPageDiscovery accessibility", () => {
  it("has no violations with a page list", async () => {
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
            lastEditedTime: null,
          },
        ]),
      ),
    );

    const { container } = renderDiscovery();
    await screen.findByText("Sprint Planning");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations in the empty state", async () => {
    server.use(http.get("/api/v1/notion/pages", () => HttpResponse.json([])));

    const { container } = renderDiscovery();
    await screen.findByText("No pages found");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations when discovery failed", async () => {
    server.use(
      http.get("/api/v1/notion/pages", () => HttpResponse.json({ message: "x" }, { status: 401 })),
    );

    const { container } = renderDiscovery();
    await screen.findByRole("alert");

    expect(await axe(container)).toHaveNoViolations();
  });
});
