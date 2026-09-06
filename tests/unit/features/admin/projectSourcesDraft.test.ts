import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDraftSource,
  connectDraftSources,
  countUnconnectedSources,
  createDraftSource,
  createDraftSourceFromDiscovery,
  createJiraDraft,
  createUploadDraft,
  hasFailedSources,
  isSameSource,
  removeDraftSource,
  setDraftSourceOwner,
  type DraftSource,
} from "../../../../src/features/admin/projectSourcesDraft";
import { knowledgeGapService } from "../../../../src/services/knowledgeGapService";
import {
  addRepositoryToProject,
  connectGithubRepository,
} from "../../../../src/services/sources/githubService";
import { connectJiraInstance } from "../../../../src/services/sources/jiraService";
import { knowledgeService } from "../../../../src/services/knowledgeService";
import type { DiscoverySelection } from "../../../../src/features/data-ingestion/components/GithubRepositoryDiscovery";

vi.mock("../../../../src/services/sources/githubService", () => ({
  connectGithubRepository: vi.fn(),
  addRepositoryToProject: vi.fn(),
}));

vi.mock("../../../../src/services/sources/jiraService", () => ({
  connectJiraInstance: vi.fn(),
}));

vi.mock("../../../../src/services/knowledgeService", () => ({
  knowledgeService: { uploadDocuments: vi.fn() },
}));

vi.mock("../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: { setComponentOwners: vi.fn() },
}));

const connectGithubRepositoryMock = vi.mocked(connectGithubRepository);
const addRepositoryToProjectMock = vi.mocked(addRepositoryToProject);
const connectJiraInstanceMock = vi.mocked(connectJiraInstance);
const uploadDocumentsMock = vi.mocked(knowledgeService.uploadDocuments);
const setComponentOwnersMock = vi.mocked(knowledgeGapService.setComponentOwners);

const jiraDraftParams = {
  displayName: "Team board",
  url: "https://acme.atlassian.net",
  userEmail: "pm@acme.test",
  tokenName: "jira-token",
};

beforeEach(() => {
  connectGithubRepositoryMock.mockReset();
  connectGithubRepositoryMock.mockResolvedValue({ transactionId: "tx" });
  addRepositoryToProjectMock.mockReset();
  addRepositoryToProjectMock.mockResolvedValue({ repositoryId: "r1", projectIds: ["p1"] });
  connectJiraInstanceMock.mockReset();
  connectJiraInstanceMock.mockResolvedValue(undefined);
  uploadDocumentsMock.mockReset();
  uploadDocumentsMock.mockResolvedValue([{ filename: "a.txt", status: "success" }]);
  setComponentOwnersMock.mockReset();
  setComponentOwnersMock.mockResolvedValue([]);
});

describe("setDraftSourceOwner", () => {
  it("names an owner on one repository and clears it again", () => {
    const draft = createDraftSource("acme", "widgets", "pat");

    const named = setDraftSourceOwner([draft], draft.id, "u1");
    expect(named[0]).toMatchObject({ type: "GITHUB", ownerUserId: "u1" });

    // Empty means "nobody", and it has to come back out as `undefined` rather than "" --
    // that is what `assignStagedOwner` checks before writing anything at all.
    const cleared = setDraftSourceOwner(named, draft.id, "");
    expect((cleared[0] as { ownerUserId?: string }).ownerUserId).toBeUndefined();
  });

  it("leaves the sources it was not asked about alone", () => {
    const github = createDraftSource("acme", "widgets", "pat");
    const jira = createJiraDraft(jiraDraftParams);

    // Only GitHub repositories carry an owner; a Jira instance is not a knowledge-gap
    // component, so pointing this at one must not invent a field on it.
    const next = setDraftSourceOwner([github, jira], jira.id, "u1");

    expect(next[0]).toBe(github);
    expect(next[1]).toBe(jira);
  });
});

describe("createDraftSource", () => {
  it("starts pending with a unique id", () => {
    const first = createDraftSource("acme", "widgets", "pat");
    const second = createDraftSource("acme", "gadgets", "pat");

    expect(first.status).toBe("pending");
    expect(first.errorMessage).toBe("");
    expect(first.id).not.toBe(second.id);
    expect(first.repositoryId).toBeUndefined();
  });

  it("carries a repository id when one is given", () => {
    const draft = createDraftSource("acme", "widgets", "pat", "repo-1");

    expect(draft.type).toBe("GITHUB");
    expect(draft.repositoryId).toBe("repo-1");
  });
});

describe("createJiraDraft / createUploadDraft", () => {
  it("stages a pending Jira instance", () => {
    const draft = createJiraDraft(jiraDraftParams);

    expect(draft.type).toBe("JIRA");
    expect(draft.status).toBe("pending");
    expect(draft).toMatchObject(jiraDraftParams);
  });

  it("stages an upload holding its files in memory", () => {
    const files = [new File(["x"], "spec.pdf")];
    const draft = createUploadDraft("Docs", files);

    expect(draft.type).toBe("UPLOAD");
    expect(draft.status).toBe("pending");
    expect(draft.displayName).toBe("Docs");
    expect(draft.files).toBe(files);
  });
});

describe("isSameSource", () => {
  it("matches GitHub repositories by owner/name regardless of casing", () => {
    expect(
      isSameSource(
        createDraftSource("acme", "widgets", "a"),
        createDraftSource("ACME", "Widgets", "b"),
      ),
    ).toBe(true);
  });

  it("matches Jira instances by URL regardless of casing and surrounding space", () => {
    expect(
      isSameSource(
        createJiraDraft(jiraDraftParams),
        createJiraDraft({ ...jiraDraftParams, url: " HTTPS://acme.atlassian.net " }),
      ),
    ).toBe(true);
  });

  it("never treats two uploads as the same source", () => {
    expect(isSameSource(createUploadDraft("A", []), createUploadDraft("A", []))).toBe(false);
  });

  it("never matches across types", () => {
    expect(
      isSameSource(createDraftSource("acme", "widgets", "a"), createJiraDraft(jiraDraftParams)),
    ).toBe(false);
  });
});

describe("createDraftSourceFromDiscovery", () => {
  const baseSelection: DiscoverySelection = {
    owner: "acme",
    name: "widgets",
    isPrivate: false,
    linkState: "new",
  };

  it("stages a new repository without a repository id", () => {
    const draft = createDraftSourceFromDiscovery(baseSelection, "pat");

    expect(draft.owner).toBe("acme");
    expect(draft.name).toBe("widgets");
    expect(draft.tokenName).toBe("pat");
    expect(draft.repositoryId).toBeUndefined();
  });

  it("keeps the repository id for a linkable repository", () => {
    const draft = createDraftSourceFromDiscovery(
      { ...baseSelection, linkState: "linkable", repositoryId: "repo-9" },
      "pat",
    );

    expect(draft.repositoryId).toBe("repo-9");
  });
});

describe("addDraftSource", () => {
  it("appends a new repository", () => {
    const sources = addDraftSource([], createDraftSource("acme", "widgets", "pat"));

    expect(sources).toHaveLength(1);
  });

  it("ignores a duplicate regardless of casing", () => {
    const sources = addDraftSource([], createDraftSource("acme", "widgets", "pat"));
    const withDuplicate = addDraftSource(
      sources,
      createDraftSource("ACME", "Widgets", "other-pat"),
    );

    expect(withDuplicate).toBe(sources);
  });
});

describe("removeDraftSource", () => {
  it("drops the matching entry only", () => {
    const first = createDraftSource("acme", "widgets", "pat");
    const second = createDraftSource("acme", "gadgets", "pat");

    expect(removeDraftSource([first, second], first.id)).toEqual([second]);
  });
});

describe("countUnconnectedSources / hasFailedSources", () => {
  it("counts everything that is not connected yet", () => {
    const sources: DraftSource[] = [
      { ...createDraftSource("a", "b", "pat"), status: "connected" },
      { ...createDraftSource("c", "d", "pat"), status: "failed" },
      createDraftSource("e", "f", "pat"),
    ];

    expect(countUnconnectedSources(sources)).toBe(2);
    expect(hasFailedSources(sources)).toBe(true);
  });

  it("reports no failures for a clean list", () => {
    expect(hasFailedSources([createDraftSource("a", "b", "pat")])).toBe(false);
  });
});

describe("connectDraftSources", () => {
  it("connects every pending source against the given project", async () => {
    const sources = [
      createDraftSource("acme", "widgets", "pat"),
      createDraftSource("acme", "gadgets", "pat"),
    ];

    const result = await connectDraftSources("p1", sources);

    expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(2);
    expect(connectGithubRepositoryMock).toHaveBeenCalledWith({
      owner: "acme",
      name: "widgets",
      tokenName: "pat",
      projectId: "p1",
    });
    expect(result.every((source) => source.status === "connected")).toBe(true);
  });

  it("keeps going after a failure and records it per source", async () => {
    connectGithubRepositoryMock
      .mockRejectedValueOnce(new Error("token expired"))
      .mockResolvedValueOnce({ transactionId: "tx" });

    const result = await connectDraftSources("p1", [
      createDraftSource("acme", "widgets", "pat"),
      createDraftSource("acme", "gadgets", "pat"),
    ]);

    expect(result[0].status).toBe("failed");
    expect(result[0].errorMessage).toBe("token expired");
    expect(result[1].status).toBe("connected");
  });

  it("skips sources that already connected, so a retry is not a re-send", async () => {
    const connected: DraftSource = {
      ...createDraftSource("acme", "widgets", "pat"),
      status: "connected",
    };

    await connectDraftSources("p1", [connected, createDraftSource("acme", "gadgets", "pat")]);

    expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(1);
    expect(connectGithubRepositoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "gadgets" }),
    );
  });

  it("links an already-ingested repository instead of re-ingesting it", async () => {
    const result = await connectDraftSources("p1", [
      createDraftSource("acme", "linked", "pat", "repo-42"),
      createDraftSource("acme", "fresh", "pat"),
    ]);

    expect(addRepositoryToProjectMock).toHaveBeenCalledTimes(1);
    expect(addRepositoryToProjectMock).toHaveBeenCalledWith("repo-42", "p1");
    expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(1);
    expect(connectGithubRepositoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "fresh" }),
    );
    expect(result.every((source) => source.status === "connected")).toBe(true);
  });

  it("reports progress as the run advances", async () => {
    const onProgress = vi.fn();

    await connectDraftSources("p1", [createDraftSource("acme", "widgets", "pat")], onProgress);

    const statuses = onProgress.mock.calls.map((call) => (call[0] as DraftSource[])[0].status);

    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("connects a Jira draft through the Jira connector", async () => {
    const result = await connectDraftSources("p1", [createJiraDraft(jiraDraftParams)]);

    expect(connectJiraInstanceMock).toHaveBeenCalledWith({
      displayName: jiraDraftParams.displayName,
      url: jiraDraftParams.url,
      userEmail: jiraDraftParams.userEmail,
      tokenName: jiraDraftParams.tokenName,
      projectId: "p1",
    });
    expect(result[0].status).toBe("connected");
  });

  it("uploads an upload draft's files against the created project", async () => {
    const files = [new File(["x"], "a.txt")];

    const result = await connectDraftSources("p1", [createUploadDraft("Docs", files)]);

    expect(uploadDocumentsMock).toHaveBeenCalledWith("p1", files);
    expect(result[0].status).toBe("connected");
  });

  it("fails an upload draft when a file could not be uploaded", async () => {
    uploadDocumentsMock.mockResolvedValueOnce([
      { filename: "a.txt", status: "success" },
      { filename: "b.txt", status: "error", error: "too large" },
    ]);

    const result = await connectDraftSources("p1", [
      createUploadDraft("Docs", [new File(["x"], "a.txt"), new File(["y"], "b.txt")]),
    ]);

    expect(result[0].status).toBe("failed");
    expect(result[0].errorMessage).toContain("1 of 2");
  });

  // The owner is named per row in the staged list, and applied once the repository is
  // connected. A repository's knowledge-gap component is `owner/name`, which is what the
  // ownership endpoint is keyed by.
  it("records the staged owner against the repository's component", async () => {
    const draft = createDraftSource("acme", "widgets", "pat");
    const staged = setDraftSourceOwner([draft], draft.id, "u1");

    const result = await connectDraftSources("p1", staged);

    expect(setComponentOwnersMock).toHaveBeenCalledWith("p1", "acme/widgets", ["u1"]);
    expect(result[0].status).toBe("connected");
    expect(result[0].ownerAssignmentFailed).toBe(false);
  });

  it("writes no ownership at all when nobody was named", async () => {
    await connectDraftSources("p1", [createDraftSource("acme", "widgets", "pat")]);

    // Empty is "nobody was named", which is not the same as clearing an existing owner --
    // the PUT replaces the list, so an unasked-for call would wipe one.
    expect(setComponentOwnersMock).not.toHaveBeenCalled();
  });

  // The repository is connected and ingesting by the time this runs, and the ownership write
  // is a weaker, PM/Admin-only call. Calling that a failed source would invite a retry of work
  // that already succeeded.
  it("keeps the source connected when the ownership write is refused", async () => {
    setComponentOwnersMock.mockRejectedValueOnce(new Error("403"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const draft = createDraftSource("acme", "widgets", "pat");
    const result = await connectDraftSources("p1", setDraftSourceOwner([draft], draft.id, "u1"));

    expect(result[0].status).toBe("connected");
    expect(result[0].ownerAssignmentFailed).toBe(true);
  });

  it("dispatches each source type in one mixed batch", async () => {
    const result = await connectDraftSources("p1", [
      createDraftSource("acme", "widgets", "pat"),
      createJiraDraft(jiraDraftParams),
      createUploadDraft("Docs", [new File(["x"], "a.txt")]),
    ]);

    expect(connectGithubRepositoryMock).toHaveBeenCalledTimes(1);
    expect(connectJiraInstanceMock).toHaveBeenCalledTimes(1);
    expect(uploadDocumentsMock).toHaveBeenCalledTimes(1);
    expect(result.every((source) => source.status === "connected")).toBe(true);
  });
});
