import { describe, it, expect, vi, afterEach } from "vitest";
import { parseOrgMetadata } from "../../../../src/features/knowledge-base/orgMetadata";

describe("parseOrgMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a fully-populated org profile", () => {
    const parsed = parseOrgMetadata(
      JSON.stringify({
        login: "sprintstart",
        name: "SprintStart",
        description: "Campus project",
        company: "Uni",
        blog: "https://sprintstart.dev",
        location: "Berlin",
        email: "ops@sprintstart.dev",
        publicRepos: 12,
        privateRepos: 3,
        teams: null,
        members: [],
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.login).toBe("sprintstart");
    expect(parsed?.name).toBe("SprintStart");
    expect(parsed?.description).toBe("Campus project");
    expect(parsed?.location).toBe("Berlin");
    expect(parsed?.publicRepos).toBe(12);
    expect(parsed?.privateRepos).toBe(3);
    expect(parsed?.teams).toBeNull();
    expect(parsed?.members).toEqual([]);
  });

  it("preserves the nested teams/members shape", () => {
    const parsed = parseOrgMetadata(
      JSON.stringify({
        login: "sprintstart",
        name: "SprintStart",
        description: null,
        company: null,
        blog: null,
        location: null,
        email: null,
        publicRepos: 1,
        privateRepos: 1,
        teams: [
          {
            name: "Platform",
            slug: "platform",
            orgLogin: "sprintstart",
            orgName: "SprintStart",
            members: [
              { login: "alice", name: "Alice" },
              { login: "bob", name: null },
            ],
          },
        ],
        members: [
          { login: "alice", url: "https://github.com/alice" },
          { login: "bob", url: "https://github.com/bob" },
        ],
      }),
    );

    expect(parsed?.teams).toHaveLength(1);
    expect(parsed?.teams?.[0].slug).toBe("platform");
    expect(parsed?.teams?.[0].members).toHaveLength(2);
    expect(parsed?.teams?.[0].members[1]).toEqual({ login: "bob", name: null });
    expect(parsed?.members).toHaveLength(2);
    expect(parsed?.members[0].url).toBe("https://github.com/alice");
  });

  it("returns null for missing or blank input", () => {
    expect(parseOrgMetadata(undefined)).toBeNull();
    expect(parseOrgMetadata(null)).toBeNull();
    expect(parseOrgMetadata("")).toBeNull();
    expect(parseOrgMetadata("   ")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseOrgMetadata("{not json")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("returns null for JSON that is not a plain object", () => {
    expect(parseOrgMetadata("123")).toBeNull();
    expect(parseOrgMetadata('"hello"')).toBeNull();
    expect(parseOrgMetadata("[]")).toBeNull();
  });
});
