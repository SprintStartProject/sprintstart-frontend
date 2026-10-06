import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { ConnectorSourcesSection } from "../../../../src/features/connectors/components/ConnectorSourcesSection";
import { getConnectorMeta, toConnectorListItems } from "../../../../src/features/connectors/data";
import { CONNECTORS } from "../../../../src/features/data-ingestion/connectors/registry";
import type { ConnectorDto } from "../../../../src/services/connectorService";

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

const notionDto: ConnectorDto = {
  id: "notion",
  name: "Notion Cloud Connector",
  enabled: true,
  firstConfiguredAt: null,
  lastConfiguredAt: null,
};

describe("Notion connector presentation", () => {
  it("has its own label, description and icon instead of the fallback", () => {
    const meta = getConnectorMeta(notionDto);

    expect(meta.label).toBe("Notion Cloud Connector");
    expect(meta.description).toMatch(/connected Notion workspaces/i);
    expect(meta.icon).toBe(CONNECTORS.NOTION.meta.icon);
    expect(meta.description).not.toBe("Sources managed by this connector.");
  });

  it("is listed with its metadata", () => {
    const [item] = toConnectorListItems([notionDto]);

    expect(item.meta.label).toBe("Notion Cloud Connector");
  });
});

describe("ConnectorSourcesSection, Notion", () => {
  it("scopes the workspace toggle to the project, like every project-owned connector", async () => {
    const user = userEvent.setup();
    const [connector] = toConnectorListItems([notionDto]);
    const workspace = {
      id: "notion-conn-1",
      name: "Acme Workspace",
      url: "https://www.notion.so/acme",
      enabled: true,
    };
    let loadUrl: string | null = null;
    let patchUrl: string | null = null;
    let patchBody: unknown = null;

    server.use(
      http.get("/api/v1/connectors/notion/sources", ({ request }) => {
        loadUrl = request.url;
        return HttpResponse.json({ connectorId: "notion", sources: [workspace] });
      }),
      http.patch("/api/v1/connectors/notion/sources/status", async ({ request }) => {
        patchUrl = request.url;
        patchBody = await request.json();
        return HttpResponse.json({
          connectorId: "notion",
          sources: [{ ...workspace, enabled: false }],
        });
      }),
    );

    render(<ConnectorSourcesSection connector={connector} projectId="proj-1" />);

    await waitFor(() => expect(screen.getByText("Acme Workspace")).toBeInTheDocument());
    expect(loadUrl).toContain("projectId=proj-1");

    await user.click(screen.getByRole("button", { name: /exclude acme workspace/i }));
    await user.click(screen.getByRole("button", { name: /save 1 change/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /include acme workspace/i })).toBeInTheDocument(),
    );
    // A connection belongs to one project, so the backend rejects a patch that does not name it.
    expect(patchUrl).toContain("projectId=proj-1");
    expect(patchBody).toEqual({ sources: [{ sourceId: workspace.id, enabled: false }] });
  });
});
