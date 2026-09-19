import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArtifactRepository,
  parseGithubMetadata,
} from "../../../../src/features/knowledge-base/githubMetadata";

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
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: null }))).toBeNull();
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: "" }))).toBeNull();
    expect(parseGithubMetadata(JSON.stringify({ repositoryFullName: "   " }))).toBeNull();
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
