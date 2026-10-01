import { describe, it, expect } from "vitest";
import {
  deriveArtifactFromCitation,
  type CitationArtifactOpen,
} from "../../../../src/features/chatbot/citationArtifact.ts";

function citation(filename: string, sourceUrl?: string): CitationArtifactOpen {
  return { artifactId: "a1", filename, sourceUrl, lines: [] };
}

describe("deriveArtifactFromCitation", () => {
  it("treats a GitHub file as a GitHub FILE", () => {
    const artifact = deriveArtifactFromCitation(
      citation("main.ts", "https://github.com/acme/app/blob/main/src/main.ts"),
    );

    expect(artifact.sourceSystem).toBe("GITHUB");
    expect(artifact.artifactType).toBe("FILE");
    expect(artifact.mime).toBe("text/plain");
  });

  it("treats a GitHub pull request as a Markdown PULL_REQUEST", () => {
    const artifact = deriveArtifactFromCitation(
      citation("PR #12: Fix login", "https://github.com/acme/app/pull/12"),
    );

    expect(artifact.sourceSystem).toBe("GITHUB");
    expect(artifact.artifactType).toBe("PULL_REQUEST");
    expect(artifact.mime).toBe("text/markdown");
  });

  it("treats a Jira issue as a JIRA ISSUE", () => {
    const artifact = deriveArtifactFromCitation(
      citation("Jira #ABC-1", "https://acme.atlassian.net/browse/ABC-1"),
    );

    expect(artifact.sourceSystem).toBe("JIRA");
    expect(artifact.artifactType).toBe("ISSUE");
  });

  it("treats a Confluence page as a CONFLUENCE PAGE, not as Jira", () => {
    const artifact = deriveArtifactFromCitation(
      citation("Onboarding", "https://acme.atlassian.net/wiki/spaces/ENG/pages/123/Onboarding"),
    );

    expect(artifact.sourceSystem).toBe("CONFLUENCE");
    expect(artifact.artifactType).toBe("PAGE");
    expect(artifact.mime).toBe("text/markdown");
  });

  it.each([
    "https://www.notion.so/acme/Team-Handbook-0123456789abcdef0123456789abcdef",
    "https://acme.notion.site/Team-Handbook-0123456789abcdef0123456789abcdef",
  ])("treats %s as a NOTION PAGE", (url) => {
    const artifact = deriveArtifactFromCitation(citation("Team Handbook", url));

    expect(artifact.sourceSystem).toBe("NOTION");
    expect(artifact.artifactType).toBe("PAGE");
    expect(artifact.mime).toBe("text/markdown");
  });

  it("treats a citation without a URL as an upload", () => {
    const artifact = deriveArtifactFromCitation(citation("handbook.pdf"));

    expect(artifact.sourceSystem).toBe("UPLOAD");
    expect(artifact.sourceUrl).toBeNull();
  });
});
