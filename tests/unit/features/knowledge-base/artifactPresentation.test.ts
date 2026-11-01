import { describe, expect, it } from "vitest";
import {
  contentKind,
  shouldRenderAsMarkdown,
} from "../../../../src/features/knowledge-base/artifactPresentation";
import type { Artifact, ArtifactContent } from "../../../../src/features/knowledge-base/types";

function artifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "a-1",
    title: "notes.txt",
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: "s-1",
    sourceUrl: null,
    mime: "text/plain",
    language: null,
    ingestedAt: "2026-01-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: "h",
    ingestionRunId: null,
    ...overrides,
  };
}

function content(mimeType = "text/plain"): ArtifactContent {
  return { content: "body", mimeType, isObjectUrl: false };
}

function renders(
  artifactContent: ArtifactContent | null | undefined,
  subject: Artifact | null,
  connectorRendersMarkdown = false,
): boolean {
  return shouldRenderAsMarkdown(artifactContent, subject, connectorRendersMarkdown);
}

describe("shouldRenderAsMarkdown", () => {
  it("is false without content, whatever the artifact", () => {
    expect(renders(null, artifact({ title: "a.md" }))).toBe(false);
    expect(renders(undefined, artifact({ artifactType: "ISSUE" }))).toBe(false);
  });

  it("is false for plain content of an ordinary file", () => {
    expect(renders(content(), artifact())).toBe(false);
    expect(renders(content(), null)).toBe(false);
  });

  it("follows a markdown mime type, charset suffix included", () => {
    expect(renders(content("text/markdown"), artifact())).toBe(true);
    expect(renders(content("text/markdown; charset=utf-8"), null)).toBe(true);
  });

  it.each(["a.md", "a.markdown", "a.mdown", "a.mkd", "README.MD"])(
    "renders the file %s as markdown",
    (title) => {
      expect(renders(content(), artifact({ title }))).toBe(true);
    },
  );

  it.each(["a.mdx", "md", "a.md.txt"])("does not take %s for markdown", (title) => {
    expect(renders(content(), artifact({ title }))).toBe(false);
  });

  it.each(["ISSUE", "PULL_REQUEST"] as const)("renders a %s as markdown", (artifactType) => {
    expect(renders(content(), artifact({ artifactType }))).toBe(true);
  });

  it.each(["PR #12 fix", "Pull request 4", "Issue #9", "JIRA #77"])(
    "renders the title %s as markdown",
    (title) => {
      expect(renders(content(), artifact({ title }))).toBe(true);
    },
  );

  it.each([
    "https://github.com/o/r/pull/3",
    "https://bitbucket.org/o/r/pull-requests/3",
    "https://github.com/o/r/issues/3",
    "https://acme.atlassian.net/browse/ABC-1",
    "https://ACME.atlassian.net/BROWSE/ABC-1",
  ])("renders the source %s as markdown", (sourceUrl) => {
    expect(renders(content(), artifact({ sourceUrl }))).toBe(true);
  });

  it("renders a wiki page by its URL", () => {
    expect(
      renders(
        content(),
        artifact({ sourceUrl: "https://acme.atlassian.net/wiki/spaces/ENG/pages/1" }),
      ),
    ).toBe(true);
  });

  it("renders the artifacts of a connector that declares markdown", () => {
    expect(renders(content(), artifact(), true)).toBe(true);
  });

  it("does not render a plain file as markdown just because the connector does not say so", () => {
    expect(renders(content(), artifact(), false)).toBe(false);
  });
});

describe("contentKind", () => {
  const text = (value = "some body text", mimeType = "text/plain"): ArtifactContent => ({
    content: value,
    mimeType,
    isObjectUrl: false,
  });

  it("is source while nothing is loaded", () => {
    expect(contentKind(null, false, "rendered")).toBe("source");
    expect(contentKind(null, true, "rendered")).toBe("source");
  });

  it("is empty for a body with nothing in it, even when it is markdown", () => {
    expect(contentKind(text(""), true, "rendered")).toBe("empty");
    expect(contentKind(text("   \n "), false, "source")).toBe("empty");
  });

  it("is markdown for markdown the reader wants formatted", () => {
    expect(contentKind(text(), true, "rendered")).toBe("markdown");
  });

  it("is source for markdown the reader wants as source", () => {
    expect(contentKind(text(), true, "source")).toBe("source");
  });

  it("is source for text that is not markdown", () => {
    expect(contentKind(text(), false, "rendered")).toBe("source");
  });

  it("is pdf for a pdf, whatever the markdown settings", () => {
    expect(contentKind(text("blob:x", "application/pdf"), false, "rendered")).toBe("pdf");
    expect(contentKind(text("blob:x", "application/pdf"), true, "rendered")).toBe("markdown");
  });

  it.each(["image/png", "image/svg+xml"])("is image for %s", (mimeType) => {
    expect(contentKind(text("blob:x", mimeType), false, "rendered")).toBe("image");
  });
});
