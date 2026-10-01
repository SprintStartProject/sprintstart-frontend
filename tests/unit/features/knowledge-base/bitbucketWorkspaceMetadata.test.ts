import { describe, it, expect, vi, afterEach } from "vitest";
import { parseBitbucketWorkspaceMetadata } from "../../../../src/features/knowledge-base/bitbucketWorkspaceMetadata";

describe("parseBitbucketWorkspaceMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a fully-populated workspace profile", () => {
    const parsed = parseBitbucketWorkspaceMetadata(
      JSON.stringify({
        workspace: "acme",
        uuid: "{1234}",
        name: "Acme",
        isPrivate: true,
        createdOn: "2020-01-01T00:00:00.000Z",
        url: "https://bitbucket.org/acme",
        members: [{ accountId: "1", nickname: "ada", displayName: "Ada Lovelace" }],
      }),
    );

    expect(parsed).toEqual({
      workspace: "acme",
      name: "Acme",
      isPrivate: true,
      createdOn: "2020-01-01T00:00:00.000Z",
      url: "https://bitbucket.org/acme",
      members: [{ accountId: "1", nickname: "ada", displayName: "Ada Lovelace" }],
    });
  });

  it("reads the visibility under Jackson's `private` spelling as well", () => {
    const parsed = parseBitbucketWorkspaceMetadata(
      JSON.stringify({ workspace: "acme", name: "Acme", private: false, members: [] }),
    );

    expect(parsed?.isPrivate).toBe(false);
  });

  it("falls back to the workspace id and nulls for missing optional fields", () => {
    const parsed = parseBitbucketWorkspaceMetadata(
      JSON.stringify({
        workspace: " acme ",
        members: [{ accountId: null, nickname: "  ", displayName: "Grace" }, "not a member"],
      }),
    );

    expect(parsed).toEqual({
      workspace: "acme",
      name: "acme",
      isPrivate: null,
      createdOn: null,
      url: null,
      members: [{ accountId: null, nickname: null, displayName: "Grace" }],
    });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a blank string", "   "],
    ["a JSON array", "[]"],
    ["a payload without workspace", JSON.stringify({ name: "Acme", members: [] })],
    ["a payload without members", JSON.stringify({ workspace: "acme" })],
    // The GitHub org shape names no workspace.
    ["a GitHub org profile", JSON.stringify({ login: "acme", members: [] })],
  ])("returns null for %s", (_label, input) => {
    expect(parseBitbucketWorkspaceMetadata(input)).toBeNull();
  });

  it("returns null and warns for malformed JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(parseBitbucketWorkspaceMetadata("{not json")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
