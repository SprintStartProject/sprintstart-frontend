import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDraftSource,
  connectDraftSources,
  connectOutcome,
  createDraftSource,
  createNotionDraft,
  isSameSource,
} from "../../../../../src/features/data-ingestion/add-source/projectSourcesDraft";
import { getConnector } from "../../../../../src/features/data-ingestion/connectors/registry";
import { ApiError } from "../../../../../src/services/apiClient";
import { notionService } from "../../../../../src/services/sources/notionService";

vi.mock("../../../../../src/services/sources/notionService", () => ({
  notionService: { createConnection: vi.fn() },
}));

const createConnectionMock = vi.mocked(notionService.createConnection);

const workspaceParams = {
  credentialName: "wiki",
  workspaceName: "Acme Workspace",
  pageCount: 12,
};

beforeEach(() => {
  createConnectionMock.mockReset();
  createConnectionMock.mockResolvedValue({} as Awaited<ReturnType<typeof createConnectionMock>>);
});

describe("createNotionDraft", () => {
  it("stages a pending Notion workspace with its credential, name and page count", () => {
    const draft = createNotionDraft(workspaceParams);

    expect(draft).toMatchObject({
      type: "NOTION",
      ...workspaceParams,
      status: "pending",
      errorMessage: "",
      wasReused: false,
      ownerAssignmentFailed: false,
    });
  });
});

describe("Notion drafts in the staged list", () => {
  it("treats the same credential as the same source, whatever the workspace name says", () => {
    expect(
      isSameSource(
        createNotionDraft(workspaceParams),
        createNotionDraft({ ...workspaceParams, workspaceName: "Renamed", pageCount: 3 }),
      ),
    ).toBe(true);
  });

  it("keeps different credentials apart and never matches across types", () => {
    expect(
      isSameSource(
        createNotionDraft(workspaceParams),
        createNotionDraft({ ...workspaceParams, credentialName: "docs" }),
      ),
    ).toBe(false);
    expect(
      isSameSource(createNotionDraft(workspaceParams), createDraftSource("acme", "widgets", "pat")),
    ).toBe(false);
  });

  it("does not stage the same credential twice", () => {
    const first = createNotionDraft(workspaceParams);
    const list = addDraftSource([first], createNotionDraft(workspaceParams));

    expect(list).toEqual([first]);
  });

  it("words a staged row with the workspace, its credential and the visible pages", () => {
    const { draft } = getConnector("NOTION");
    const staged = createNotionDraft(workspaceParams);

    expect(draft.title(staged)).toBe("Acme Workspace");
    expect(draft.detail(staged)).toBe("wiki · 12 pages visible");
    expect(draft.detail({ ...staged, pageCount: 1 })).toBe("wiki · 1 page visible");
  });
});

describe("connectDraftSources with Notion workspaces", () => {
  it("posts the credential name to the project", async () => {
    const result = await connectDraftSources("p1", [createNotionDraft(workspaceParams)]);

    expect(createConnectionMock).toHaveBeenCalledTimes(1);
    expect(createConnectionMock).toHaveBeenCalledWith("p1", { credentialName: "wiki" });
    expect(result.every((source) => source.status === "connected")).toBe(true);
  });

  it("never reports a Notion workspace as reused", async () => {
    const result = await connectDraftSources("p1", [createNotionDraft(workspaceParams)]);

    expect(result[0].wasReused).toBe(false);
    expect(connectOutcome(result)).toBe("ingesting");
  });

  it("turns a 409 into a readable per-workspace failure and keeps going", async () => {
    createConnectionMock
      .mockRejectedValueOnce(new ApiError(409, "Conflict"))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof createConnectionMock>>);

    const result = await connectDraftSources("p1", [
      createNotionDraft(workspaceParams),
      createNotionDraft({ credentialName: "docs", workspaceName: "Docs Workspace", pageCount: 1 }),
    ]);

    expect(result[0].status).toBe("failed");
    expect(result[0].errorMessage).toBe(
      "This Notion workspace is already connected to this project.",
    );
    expect(result[1].status).toBe("connected");
  });

  it("passes other failures through with the server message", async () => {
    createConnectionMock.mockRejectedValueOnce(new ApiError(422, "Notion rejected the token."));

    const result = await connectDraftSources("p1", [createNotionDraft(workspaceParams)]);

    expect(result[0].status).toBe("failed");
    expect(result[0].errorMessage).toBe("Notion rejected the token.");
  });
});
