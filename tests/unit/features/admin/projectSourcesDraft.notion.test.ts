import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDraftSource,
  connectDraftSources,
  connectOutcome,
  createDraftSource,
  createNotionDraft,
  isSameSource,
} from "../../../../src/features/admin/projectSourcesDraft";
import { ApiError } from "../../../../src/services/apiClient";
import { notionService } from "../../../../src/services/sources/notionService";

vi.mock("../../../../src/services/sources/notionService", () => ({
  notionService: { createConnection: vi.fn() },
}));

const createConnectionMock = vi.mocked(notionService.createConnection);

const pageParams = {
  pageId: "page-1",
  pageTitle: "Sprint Planning",
  pageUrl: "https://www.notion.so/Sprint-Planning-page1",
  credentialName: "wiki",
};

beforeEach(() => {
  createConnectionMock.mockReset();
  createConnectionMock.mockResolvedValue({} as Awaited<ReturnType<typeof createConnectionMock>>);
});

describe("createNotionDraft", () => {
  it("stages a pending Notion page with its identity and credential", () => {
    const draft = createNotionDraft(pageParams);

    expect(draft).toMatchObject({
      type: "NOTION",
      ...pageParams,
      status: "pending",
      errorMessage: "",
      wasReused: false,
      ownerAssignmentFailed: false,
    });
  });
});

describe("Notion drafts in the staged list", () => {
  it("treats the same page id as the same source, whatever the credential", () => {
    expect(
      isSameSource(
        createNotionDraft(pageParams),
        createNotionDraft({ ...pageParams, credentialName: "other", pageTitle: "Renamed" }),
      ),
    ).toBe(true);
  });

  it("keeps different pages apart and never matches across types", () => {
    expect(
      isSameSource(
        createNotionDraft(pageParams),
        createNotionDraft({ ...pageParams, pageId: "x" }),
      ),
    ).toBe(false);
    expect(
      isSameSource(createNotionDraft(pageParams), createDraftSource("acme", "widgets", "pat")),
    ).toBe(false);
  });

  it("does not stage the same page twice", () => {
    const first = createNotionDraft(pageParams);
    const list = addDraftSource([first], createNotionDraft(pageParams));

    expect(list).toEqual([first]);
  });
});

describe("connectDraftSources with Notion pages", () => {
  it("posts each page to the project on its own", async () => {
    const result = await connectDraftSources("p1", [
      createNotionDraft(pageParams),
      createNotionDraft({ ...pageParams, pageId: "page-2", pageTitle: "Retro" }),
    ]);

    expect(createConnectionMock).toHaveBeenCalledTimes(2);
    expect(createConnectionMock).toHaveBeenNthCalledWith(1, "p1", {
      credentialName: "wiki",
      pageId: "page-1",
    });
    expect(createConnectionMock).toHaveBeenNthCalledWith(2, "p1", {
      credentialName: "wiki",
      pageId: "page-2",
    });
    expect(result.every((source) => source.status === "connected")).toBe(true);
  });

  it("never reports a Notion page as reused", async () => {
    const result = await connectDraftSources("p1", [createNotionDraft(pageParams)]);

    expect(result[0].wasReused).toBe(false);
    expect(connectOutcome(result)).toBe("ingesting");
  });

  it("turns a 409 into a readable per-page failure and keeps going", async () => {
    createConnectionMock
      .mockRejectedValueOnce(new ApiError(409, "Conflict"))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof createConnectionMock>>);

    const result = await connectDraftSources("p1", [
      createNotionDraft(pageParams),
      createNotionDraft({ ...pageParams, pageId: "page-2" }),
    ]);

    expect(result[0].status).toBe("failed");
    expect(result[0].errorMessage).toBe("This Notion page is already connected to a project.");
    expect(result[1].status).toBe("connected");
  });

  it("passes other failures through with the server message", async () => {
    createConnectionMock.mockRejectedValueOnce(new ApiError(502, "Notion is unreachable"));

    const result = await connectDraftSources("p1", [createNotionDraft(pageParams)]);

    expect(result[0].status).toBe("failed");
    expect(result[0].errorMessage).toBe("Notion is unreachable");
  });
});
