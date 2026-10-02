import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArtifactRepository,
  matchesRepository,
  parseBitbucketMetadata,
  parseGithubMetadata,
} from "../../../../src/features/knowledge-base/githubMetadata";
import type { Artifact } from "../../../../src/features/knowledge-base/types";

describe("parseGithubMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the backend shape with repositoryId and repositoryFullName", () => {
    const parsed = parseGithubMetadata(
      JSON.stringify({
        repositoryId: "0b6e9b16-0000-4000-8000-000000000001",
        repositoryFullName: "sprintstart/sprintstart-backend",
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.repositoryId).toBe("0b6e9b16-0000-4000-8000-000000000001");
    expect(parsed?.repositoryFullName).toBe("sprintstart/sprintstart-backend");
  });

  it("accepts metadata that only carries repositoryFullName", () => {
    // Defensive: the backend always sends repositoryId next to it, but nothing
    // consumes it, so its absence must not cost the repository display.
    const parsed = parseGithubMetadata(JSON.stringify({ repositoryFullName: "owner/repo" }));

    expect(parsed?.repositoryFullName).toBe("owner/repo");
    expect(parsed?.repositoryId).toBeUndefined();
  });

  it("returns null for missing or blank input", () => {
    expect(parseGithubMetadata(undefined)).toBeNull();
    expect(parseGithubMetadata(null)).toBeNull();
    expect(parseGithubMetadata("")).toBeNull();
    expect(parseGithubMetadata("   ")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseGithubMetadata("{not json")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("returns null for JSON that is not a plain object", () => {
    expect(parseGithubMetadata("123")).toBeNull();
    expect(parseGithubMetadata("true")).toBeNull();
    expect(parseGithubMetadata('"hello"')).toBeNull();
    expect(parseGithubMetadata("null")).toBeNull();
    expect(parseGithubMetadata("[]")).toBeNull();
  });

  it("returns null when repositoryFullName is missing or not a usable string", () => {
    expect(parseGithubMetadata("{}")).toBeNull();
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: 42 }))).toBeNull();
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: "" }))).toBeNull();
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: "   " }))).toBeNull();
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: null }))).toBeNull();
  });

  it("trims the repository name and drops a non-string repositoryId", () => {
    const parsed = parseGithubMetadata(
      JSON.stringify({ repositoryId: 42, repositoryFullName: "  owner/repo  " }),
    );

    expect(parsed?.repositoryFullName).toBe("owner/repo");
    // The parsed shape may only promise what it validated: repositoryId is
    // unconsumed, so a non-string payload value must not be typed as a string.
    expect(parsed?.repositoryId).toBeUndefined();
  });
});

describe("getArtifactRepository", () => {
  const repoMetadata = JSON.stringify({
    repositoryId: "r1",
    repositoryFullName: "sprintstart/sprintstart-frontend",
  });

  it.each(["COMMIT", "FILE", "ISSUE", "PULL_REQUEST"] as const)(
    "extracts the repository for a GitHub %s artifact",
    (artifactType) => {
      expect(
        getArtifactRepository({
          sourceSystem: "GITHUB",
          artifactType,
          metadata: repoMetadata,
        }),
      ).toBe("sprintstart/sprintstart-frontend");
    },
  );

  it("returns null for GitHub ORG_METADATA even when metadata holds a repository field", () => {
    // ORG_METADATA is GitHub-sourced but its metadata is the org profile — the
    // explicit type gate keeps the org JSON away from the repo parser.
    expect(
      getArtifactRepository({
        sourceSystem: "GITHUB",
        artifactType: "ORG_METADATA",
        metadata: repoMetadata,
      }),
    ).toBeNull();
  });

  it("returns null for non-GitHub artifacts regardless of metadata content", () => {
    for (const sourceSystem of ["UPLOAD", "JIRA", "CONFLUENCE"] as const) {
      expect(
        getArtifactRepository({ sourceSystem, artifactType: "FILE", metadata: repoMetadata }),
      ).toBeNull();
    }
  });

  it("returns null when a GitHub artifact has no metadata at all", () => {
    expect(
      getArtifactRepository({ sourceSystem: "GITHUB", artifactType: "FILE", metadata: undefined }),
    ).toBeNull();
  });
});

describe("matchesRepository", () => {
  const repoMetadata = JSON.stringify({
    repositoryId: "r1",
    repositoryFullName: "sprintstart/sprintstart-frontend",
  });

  it("matches everything while nothing is selected", () => {
    expect(
      matchesRepository(
        { sourceSystem: "GITHUB", artifactType: "FILE", metadata: repoMetadata },
        new Set(),
      ),
    ).toBe(true);
  });

  it("narrows repo-scoped GitHub artifacts to the selected repositories", () => {
    const artifact: Pick<Artifact, "sourceSystem" | "artifactType" | "metadata"> = {
      sourceSystem: "GITHUB",
      artifactType: "FILE",
      metadata: repoMetadata,
    };

    expect(matchesRepository(artifact, new Set(["sprintstart/sprintstart-frontend"]))).toBe(true);
    expect(matchesRepository(artifact, new Set(["other/repo"]))).toBe(false);
  });

  it("always matches artifacts from other sources", () => {
    // Other sources are outside the facet's reach (matchesFormat's connector rule).
    expect(
      matchesRepository(
        { sourceSystem: "UPLOAD", artifactType: "FILE", metadata: undefined },
        new Set(["owner/repo"]),
      ),
    ).toBe(true);
  });

  it("shows the org profile when its org owns a chosen repository", () => {
    const orgProfile = JSON.stringify({ login: "sprintstart", members: [] });

    expect(
      matchesRepository(
        { sourceSystem: "GITHUB", artifactType: "ORG_METADATA", metadata: orgProfile },
        new Set(["sprintstart/sprintstart-backend"]),
      ),
    ).toBe(true);
  });

  it("hides org profiles of unrelated orgs and GitHub artifacts that name no repository", () => {
    const orgProfile = JSON.stringify({ login: "sprintstart", members: [] });

    // An org that owns none of the chosen repos must not pose as their content.
    expect(
      matchesRepository(
        { sourceSystem: "GITHUB", artifactType: "ORG_METADATA", metadata: orgProfile },
        new Set(["daniilperkin-uni/pe2_todo_app"]),
      ),
    ).toBe(false);
    // Repo-scoped artifacts with unusable metadata have no repository to match.
    // The malformed blob makes the parser warn — silence it here like the parse
    // tests do, so the real warnings stay visible in the output.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      matchesRepository(
        { sourceSystem: "GITHUB", artifactType: "FILE", metadata: "{not json" },
        new Set(["owner/repo"]),
      ),
    ).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("matches owner halves case-insensitively", () => {
    // GitHub logins are case-insensitive, and the two strings come from
    // independent payloads — the owning-org rule must survive a capital letter.
    const orgProfile = JSON.stringify({ login: "sprintstart", members: [] });

    expect(
      matchesRepository(
        { sourceSystem: "GITHUB", artifactType: "ORG_METADATA", metadata: orgProfile },
        new Set(["SprintStart/sprintstart-backend"]),
      ),
    ).toBe(true);
  });
});

describe("parseBitbucketMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the backend shape with repositoryId, workspace and slug", () => {
    const parsed = parseBitbucketMetadata(
      JSON.stringify({ repositoryId: "bb-1", workspace: "acme", slug: "widgets" }),
    );

    expect(parsed).toEqual({ repositoryId: "bb-1", workspace: "acme", slug: "widgets" });
  });

  it("accepts a workspace profile that names no slug", () => {
    const parsed = parseBitbucketMetadata(
      JSON.stringify({ workspace: "acme", uuid: "{1}", name: "Acme", members: [] }),
    );

    expect(parsed?.workspace).toBe("acme");
    expect(parsed?.slug).toBeUndefined();
  });

  it("trims the names and drops a blank slug or non-string repositoryId", () => {
    const parsed = parseBitbucketMetadata(
      JSON.stringify({ repositoryId: 7, workspace: "  acme ", slug: "   " }),
    );

    expect(parsed).toEqual({ repositoryId: undefined, workspace: "acme", slug: undefined });
  });

  it("returns null for missing, malformed or workspace-less metadata", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(parseBitbucketMetadata(undefined)).toBeNull();
    expect(parseBitbucketMetadata("")).toBeNull();
    expect(parseBitbucketMetadata("{not json")).toBeNull();
    expect(parseBitbucketMetadata("[1]")).toBeNull();
    expect(parseBitbucketMetadata(JSON.stringify({ slug: "widgets" }))).toBeNull();
    expect(parseBitbucketMetadata(JSON.stringify({ workspace: " " }))).toBeNull();
  });

  it("names Bitbucket in the malformed-metadata warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    parseBitbucketMetadata("{not json");

    expect(warn).toHaveBeenCalledWith(
      "Ignoring unparseable Bitbucket artifact metadata",
      "{not json",
    );
  });
});

describe("getArtifactRepository for Bitbucket", () => {
  const repoMetadata = JSON.stringify({ repositoryId: "bb-1", workspace: "acme", slug: "widgets" });

  it("resolves workspace/slug for a repository artifact", () => {
    expect(
      getArtifactRepository({
        sourceSystem: "BITBUCKET",
        artifactType: "PULL_REQUEST",
        metadata: repoMetadata,
      }),
    ).toBe("acme/widgets");
  });

  it("returns null for the workspace profile and for unusable metadata", () => {
    expect(
      getArtifactRepository({
        sourceSystem: "BITBUCKET",
        artifactType: "ORG_METADATA",
        metadata: JSON.stringify({ workspace: "acme", members: [] }),
      }),
    ).toBeNull();
    expect(
      getArtifactRepository({ sourceSystem: "BITBUCKET", artifactType: "FILE", metadata: "" }),
    ).toBeNull();
  });

  it("does not read GitHub's repositoryFullName from a Bitbucket artifact", () => {
    expect(
      getArtifactRepository({
        sourceSystem: "BITBUCKET",
        artifactType: "FILE",
        metadata: JSON.stringify({ repositoryFullName: "acme/widgets" }),
      }),
    ).toBeNull();
  });
});

describe("matchesRepository for Bitbucket", () => {
  const artifact = (
    slug: string,
  ): Pick<Artifact, "sourceSystem" | "artifactType" | "metadata"> => ({
    sourceSystem: "BITBUCKET",
    artifactType: "FILE",
    metadata: JSON.stringify({ repositoryId: "bb-1", workspace: "acme", slug }),
  });
  const workspaceProfile = (
    workspace: string,
  ): Pick<Artifact, "sourceSystem" | "artifactType" | "metadata"> => ({
    sourceSystem: "BITBUCKET",
    artifactType: "ORG_METADATA",
    metadata: JSON.stringify({ workspace, members: [] }),
  });

  it("narrows Bitbucket repository artifacts to the selected repositories", () => {
    expect(matchesRepository(artifact("widgets"), new Set(["acme/widgets"]))).toBe(true);
    expect(matchesRepository(artifact("gadgets"), new Set(["acme/widgets"]))).toBe(false);
  });

  it("matches everything while nothing is selected", () => {
    expect(matchesRepository(artifact("widgets"), new Set())).toBe(true);
  });

  it("shows the workspace profile when its workspace owns a chosen repository, case-insensitively", () => {
    expect(matchesRepository(workspaceProfile("ACME"), new Set(["acme/widgets"]))).toBe(true);
    expect(matchesRepository(workspaceProfile("other"), new Set(["acme/widgets"]))).toBe(false);
  });

  it("still lets other sources through", () => {
    expect(
      matchesRepository(
        { sourceSystem: "UPLOAD", artifactType: "FILE", metadata: "" },
        new Set(["acme/widgets"]),
      ),
    ).toBe(true);
  });
});
