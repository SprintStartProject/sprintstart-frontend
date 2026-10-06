import { describe, expect, it } from "vitest";
import { deriveArtifactFromCitation } from "../../../../../src/features/buddy/citations/citationArtifact";

describe("deriveArtifactFromCitation", () => {
  const open = (filename: string, sourceUrl?: string) =>
    deriveArtifactFromCitation({ artifactId: "a-1", filename, sourceUrl, lines: [] });

  it("takes the source system from the connector that claims the URL", () => {
    expect(open("README.md", "https://github.com/acme/api/blob/main/README.md").sourceSystem).toBe(
      "GITHUB",
    );
    expect(open("Jira #ENG-1", "https://acme.atlassian.net/browse/ENG-1").sourceSystem).toBe(
      "JIRA",
    );
    expect(
      open("Onboarding", "https://acme.atlassian.net/wiki/spaces/ENG/pages/1").sourceSystem,
    ).toBe("CONFLUENCE");
  });

  it("attributes a bitbucket.org citation to Bitbucket and types its pull requests", () => {
    const pullRequest = open("PR #4", "https://bitbucket.org/acme/widgets/pull-requests/4");
    const file = open("main.ts", "https://bitbucket.org/acme/widgets/src/main/main.ts");

    expect(pullRequest.sourceSystem).toBe("BITBUCKET");
    expect(pullRequest.artifactType).toBe("PULL_REQUEST");
    expect(pullRequest.mime).toBe("text/markdown");
    expect(file.sourceSystem).toBe("BITBUCKET");
    expect(file.artifactType).toBe("FILE");
  });

  it("attributes notion.so and notion.site citations to Notion", () => {
    const page = open("Handbook", "https://www.notion.so/acme/Handbook-123");
    const site = open("Handbook", "https://acme.notion.site/Handbook-123");

    expect(page.sourceSystem).toBe("NOTION");
    expect(site.sourceSystem).toBe("NOTION");
    expect(page.sourceUrl).toBe("https://www.notion.so/acme/Handbook-123");
  });

  it("treats a citation without a URL as an upload with no source link", () => {
    const artifact = open("handbook.pdf");

    expect(artifact.sourceSystem).toBe("UPLOAD");
    expect(artifact.sourceUrl).toBeNull();
  });

  it("types pull requests and issues and marks them as Markdown", () => {
    const pullRequest = open("PR #4", "https://github.com/acme/api/pull/4");
    const issue = open("Issue #7", "https://github.com/acme/api/issues/7");

    expect(pullRequest.artifactType).toBe("PULL_REQUEST");
    expect(pullRequest.mime).toBe("text/markdown");
    expect(issue.artifactType).toBe("ISSUE");
    expect(open("main.ts", "https://github.com/acme/api/blob/main/main.ts").mime).toBe(
      "text/plain",
    );
  });
});
