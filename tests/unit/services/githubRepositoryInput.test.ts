import { describe, it, expect } from "vitest";
import {
  parseGithubRepositoryInput,
  parseGithubRepositoryReference,
} from "../../../src/services/sources/githubRepositoryInput";

describe("parseGithubRepositoryReference", () => {
  it("parses a plain owner/name reference", () => {
    expect(parseGithubRepositoryReference("acme/widgets")).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it.each([
    "https://github.com/acme/widgets",
    "http://github.com/acme/widgets",
    "github.com/acme/widgets",
    "git@github.com:acme/widgets.git",
    "/acme/widgets/",
  ])("strips the surrounding syntax of %s", (value) => {
    expect(parseGithubRepositoryReference(value)).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it("returns null when the repository half is missing", () => {
    expect(parseGithubRepositoryReference("acme")).toBeNull();
  });
});

describe("parseGithubRepositoryInput", () => {
  it("combines the two fields", () => {
    expect(parseGithubRepositoryInput("acme", "widgets")).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it("trims whitespace around both fields", () => {
    expect(parseGithubRepositoryInput("  acme ", " widgets  ")).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it("lets a combined reference in the owner field win", () => {
    expect(parseGithubRepositoryInput("acme/widgets", "ignored")).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it("returns null when only the owner is given", () => {
    expect(parseGithubRepositoryInput("acme", "")).toBeNull();
  });

  it("returns null when both fields are empty", () => {
    expect(parseGithubRepositoryInput("", "")).toBeNull();
  });
});
