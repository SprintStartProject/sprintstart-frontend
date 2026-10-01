import { describe, it, expect } from "vitest";
import {
  parseBitbucketRepositoryInput,
  parseBitbucketRepositoryReference,
  parseBitbucketWorkspaceInput,
} from "../../../src/services/sources/bitbucketRepositoryInput";

describe("parseBitbucketRepositoryReference", () => {
  it("parses a plain workspace/slug reference", () => {
    expect(parseBitbucketRepositoryReference("acme/widgets")).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
  });

  it.each([
    "https://bitbucket.org/acme/widgets",
    "http://bitbucket.org/acme/widgets",
    "bitbucket.org/acme/widgets",
    "git@bitbucket.org:acme/widgets.git",
    "ssh://git@bitbucket.org/acme/widgets.git",
    "https://someone@bitbucket.org/acme/widgets.git",
    "https://bitbucket.org/acme/widgets/src/main/",
    "https://bitbucket.org/acme/widgets/pull-requests/12",
    "/acme/widgets/",
  ])("strips the surrounding syntax of %s", (value) => {
    expect(parseBitbucketRepositoryReference(value)).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
  });

  it("returns null when the slug half is missing", () => {
    expect(parseBitbucketRepositoryReference("acme")).toBeNull();
    expect(parseBitbucketRepositoryReference("https://bitbucket.org/acme/")).toBeNull();
  });

  it("returns null for an empty value", () => {
    expect(parseBitbucketRepositoryReference("  ")).toBeNull();
  });
});

describe("parseBitbucketWorkspaceInput", () => {
  it.each([
    "acme",
    "  acme  ",
    "bitbucket.org/acme",
    "https://bitbucket.org/acme/",
    "https://bitbucket.org/acme/widgets",
    "git@bitbucket.org:acme/widgets.git",
  ])("extracts the workspace from %s", (value) => {
    expect(parseBitbucketWorkspaceInput(value)).toBe("acme");
  });

  it("returns null for an empty value", () => {
    expect(parseBitbucketWorkspaceInput("")).toBeNull();
    expect(parseBitbucketWorkspaceInput("https://bitbucket.org/")).toBeNull();
  });
});

describe("parseBitbucketRepositoryInput", () => {
  it("combines the two fields", () => {
    expect(parseBitbucketRepositoryInput("acme", "widgets")).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
  });

  it("trims the two fields", () => {
    expect(parseBitbucketRepositoryInput("  acme ", " widgets  ")).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
  });

  it("prefers a combined reference in the workspace field", () => {
    expect(parseBitbucketRepositoryInput("https://bitbucket.org/acme/widgets", "ignored")).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
  });

  it("returns null when only one half is given", () => {
    expect(parseBitbucketRepositoryInput("acme", "")).toBeNull();
    expect(parseBitbucketRepositoryInput("", "widgets")).toBeNull();
  });

  // The backend matches connections by exact coordinates, and Bitbucket ids are
  // lowercase, so a capitalized entry must not address a second connection.
  it("lowercases the workspace and slug", () => {
    expect(parseBitbucketRepositoryInput("Acme", "Widgets")).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
    expect(parseBitbucketRepositoryReference("https://bitbucket.org/Acme/Widgets.git")).toEqual({
      workspace: "acme",
      slug: "widgets",
    });
    expect(parseBitbucketWorkspaceInput("bitbucket.org/ACME")).toBe("acme");
  });
});
