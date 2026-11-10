import { describe, expect, it } from "vitest";
import {
  connectedIndex,
  discoverErrorMessage,
  filterRepositories,
  fullNameOf,
  isSelectableState,
  linkStateOf,
  linkStatesFor,
  parseFreshRequest,
  selectionFrom,
  toggled,
  toggledAll,
} from "../../../../../src/features/data-ingestion/components/discovery/discoveryRules";
import type {
  DiscoveredRepositoryItem,
  RepositoryDiscoveryAdapter,
} from "../../../../../src/features/data-ingestion/components/discovery/discoveryTypes";

function repo(
  name: string,
  extra: Partial<DiscoveredRepositoryItem> = {},
): DiscoveredRepositoryItem {
  return {
    name,
    isPrivate: false,
    url: null,
    alreadyConnected: false,
    isEnabled: null,
    ...extra,
  };
}

function adapter(overrides: Partial<RepositoryDiscoveryAdapter> = {}): RepositoryDiscoveryAdapter {
  return {
    sourceSystem: "GITHUB",
    providerName: "GitHub",
    discover: () => Promise.resolve({ repositories: [], hasMore: false }),
    parseInput: (value) => (value.trim() ? { owner: value.trim(), name: null } : null),
    ownerLabel: "Owner",
    ownerPlaceholder: "owner",
    invalidInputMessage: "bad owner",
    credentialRequiredMessage: "need credential",
    missingCredentialNotice: "none",
    emptyResultHint: null,
    ...overrides,
  };
}

describe("fullNameOf", () => {
  it("joins and lowercases", () => {
    expect(fullNameOf("Acme", "Web-App")).toBe("acme/web-app");
  });
});

describe("connectedIndex", () => {
  it("treats rows without a system as GitHub and keeps only repository rows in the id map", () => {
    const index = connectedIndex(
      [
        { sourceId: "Acme/One", repositoryId: "r1" },
        { sourceId: "acme/two", repositoryId: null },
        { sourceId: "acme/three", repositoryId: "r3", sourceSystem: "BITBUCKET" },
      ],
      [{ sourceId: "ACME/One" }, { sourceId: "acme/x", sourceSystem: "BITBUCKET" }],
      "GITHUB",
    );
    expect([...index.idsByFullName]).toEqual([["acme/one", "r1"]]);
    expect([...index.projectFullNames]).toEqual(["acme/one"]);
  });

  it("selects the other provider when asked", () => {
    const index = connectedIndex(
      [{ sourceId: "a/b", repositoryId: "r", sourceSystem: "BITBUCKET" }],
      [{ sourceId: "a/b", sourceSystem: "BITBUCKET" }],
      "BITBUCKET",
    );
    expect(index.idsByFullName.get("a/b")).toBe("r");
    expect(index.projectFullNames.has("a/b")).toBe(true);
  });
});

describe("linkStateOf", () => {
  const index = {
    idsByFullName: new Map([["a/linked", "id"]]),
    projectFullNames: new Set(["a/mine"]),
  };

  it("in-project wins even when not marked connected", () => {
    expect(linkStateOf(repo("mine"), "a/mine", index)).toBe("in-project");
  });
  it("is new when not connected anywhere", () => {
    expect(linkStateOf(repo("fresh"), "a/fresh", index)).toBe("new");
  });
  it("is linkable when connected elsewhere with a known id", () => {
    expect(linkStateOf(repo("linked", { alreadyConnected: true }), "a/linked", index)).toBe(
      "linkable",
    );
  });
  it("is unresolved when connected elsewhere without an id", () => {
    expect(linkStateOf(repo("odd", { alreadyConnected: true }), "a/odd", index)).toBe("unresolved");
  });
});

describe("linkStatesFor / isSelectableState", () => {
  it("maps each repository name to its state", () => {
    const index = { idsByFullName: new Map(), projectFullNames: new Set(["o/in"]) };
    const states = linkStatesFor([repo("in"), repo("out")], "O", index);
    expect(states.get("in")).toBe("in-project");
    expect(states.get("out")).toBe("new");
  });

  it("only new and linkable are selectable", () => {
    expect(isSelectableState("new")).toBe(true);
    expect(isSelectableState("linkable")).toBe(true);
    expect(isSelectableState("in-project")).toBe(false);
    expect(isSelectableState("unresolved")).toBe(false);
  });
});

describe("filterRepositories", () => {
  const repos = [repo("alpha"), repo("beta", { label: "Gamma Thing" })];

  it("returns all for a blank filter", () => {
    expect(filterRepositories(repos, "   ")).toBe(repos);
  });
  it("matches name case-insensitively and trims", () => {
    expect(filterRepositories(repos, " ALP ").map((r) => r.name)).toEqual(["alpha"]);
  });
  it("matches the label too", () => {
    expect(filterRepositories(repos, "gamma").map((r) => r.name)).toEqual(["beta"]);
  });
  it("returns nothing when nothing matches", () => {
    expect(filterRepositories(repos, "zzz")).toEqual([]);
  });
});

describe("toggled / toggledAll", () => {
  it("adds and removes without mutating the input", () => {
    const start = new Set(["a"]);
    expect([...toggled(start, "b")]).toEqual(["a", "b"]);
    expect([...toggled(start, "a")]).toEqual([]);
    expect([...start]).toEqual(["a"]);
  });

  it("selects all names, or clears them when all were selected", () => {
    const start = new Set(["x"]);
    expect([...toggledAll(start, ["a", "b"], false)].sort()).toEqual(["a", "b", "x"]);
    expect([...toggledAll(new Set(["x", "a", "b"]), ["a", "b"], true)]).toEqual(["x"]);
    expect([...start]).toEqual(["x"]);
  });
});

describe("selectionFrom", () => {
  it("keeps only selected repositories with state and id", () => {
    const result = selectionFrom({
      repositories: [repo("a", { isPrivate: true }), repo("b"), repo("c")],
      selected: new Set(["a", "c"]),
      owner: "Acme",
      linkStates: new Map([["a", "linkable" as const]]),
      idsByFullName: new Map([["acme/a", "id-a"]]),
    });
    expect(result).toEqual([
      { owner: "Acme", name: "a", isPrivate: true, linkState: "linkable", repositoryId: "id-a" },
      { owner: "Acme", name: "c", isPrivate: false, linkState: "new", repositoryId: undefined },
    ]);
  });
});

describe("parseFreshRequest", () => {
  it("fails on unparsable owner first", () => {
    expect(parseFreshRequest(adapter(), " ", "cred")).toEqual({
      ok: false,
      error: "bad owner",
    });
  });
  it("fails on a blank credential", () => {
    expect(parseFreshRequest(adapter(), "acme", "  ")).toEqual({
      ok: false,
      error: "need credential",
    });
  });
  it("returns owner, repository name and trimmed credential", () => {
    const withName = adapter({ parseInput: () => ({ owner: "acme", name: "web" }) });
    expect(parseFreshRequest(withName, "acme/web", " tok ")).toEqual({
      ok: true,
      owner: "acme",
      repositoryName: "web",
      credential: "tok",
    });
  });
});

describe("discoverErrorMessage", () => {
  it("prefers the adapter wording", () => {
    const custom = adapter({ describeError: (_e, owner) => `no ${owner}` });
    expect(discoverErrorMessage(custom, new Error("x"), "acme")).toBe("no acme");
  });
  it("falls back to the error message, then the generic one", () => {
    const nullish = adapter({ describeError: () => null });
    expect(discoverErrorMessage(nullish, new Error("boom"), "a")).toBe("boom");
    expect(discoverErrorMessage(adapter(), "str", "a")).toBe(
      "Repositories could not be discovered.",
    );
  });
});
