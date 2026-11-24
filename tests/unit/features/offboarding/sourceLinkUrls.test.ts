import { describe, it, expect } from "vitest";
import { sourceLinks } from "../../../../src/features/offboarding/sourceLinks";

describe("sourceLinks", () => {
  it("points a GitHub file at the default branch and at its history", () => {
    expect(sourceLinks("github:acme/app", "src/main/A.kt")).toEqual({
      provider: "GitHub",
      file: "https://github.com/acme/app/blob/HEAD/src/main/A.kt",
      history: "https://github.com/acme/app/commits/HEAD/src/main/A.kt",
    });
  });

  it("points a Bitbucket file at the default branch and knows no history address", () => {
    expect(sourceLinks("bitbucket:team/app", "src/A.kt")).toEqual({
      provider: "Bitbucket",
      file: "https://bitbucket.org/team/app/src/HEAD/src/A.kt",
      history: null,
    });
  });

  it("keeps the slashes of a path and encodes what a URL cannot hold", () => {
    const links = sourceLinks("github:acme/app", "docs/My notes #1/a b.md");

    expect(links?.file).toBe(
      "https://github.com/acme/app/blob/HEAD/docs/My%20notes%20%231/a%20b.md",
    );
  });

  it("accepts the dots, dashes and underscores a repository name has", () => {
    expect(sourceLinks("github:acme-corp/my_app.v2", "a.kt")?.file).toBe(
      "https://github.com/acme-corp/my_app.v2/blob/HEAD/a.kt",
    );
  });

  it("has no links for a host it does not know", () => {
    expect(sourceLinks("gitlab:acme/app", "a.kt")).toBeNull();
    expect(sourceLinks("local-repo", "a.kt")).toBeNull();
  });

  it("has no links for a repository key that is not owner and name", () => {
    expect(sourceLinks("github:acme", "a.kt")).toBeNull();
    expect(sourceLinks("github:acme/app/extra", "a.kt")).toBeNull();
    expect(sourceLinks("github:acme/app?x=1", "a.kt")).toBeNull();
    expect(sourceLinks("github:", "a.kt")).toBeNull();
  });

  it("does not take a key that only ends like a repository", () => {
    expect(sourceLinks("xgithub:acme/app", "a.kt")).toBeNull();
    expect(sourceLinks(" github:acme/app", "a.kt")).toBeNull();
  });
});
