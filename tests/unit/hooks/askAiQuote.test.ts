import { describe, it, expect } from "vitest";
import { MAX_QUOTE_CHARS, quoteForChat, questionForArtifact } from "../../../src/hooks/askAiQuote";

describe("quoteForChat", () => {
  it("quotes every line of the selection", () => {
    const message = quoteForChat({ text: "first line\nsecond line" });

    expect(message).toBe("> first line\n> second line\n\nExplain this in context.");
  });

  it("drops the blank lines a drag across paragraphs picks up", () => {
    const message = quoteForChat({ text: "one\n\n   \ntwo\n" });

    expect(message).toBe("> one\n> two\n\nExplain this in context.");
  });

  it("names where the words came from when it knows, and says nothing when it does not", () => {
    expect(quoteForChat({ text: "one", source: "Deployment" })).toContain("From Deployment");
    expect(quoteForChat({ text: "one", source: "  " })).not.toContain("From");
  });

  it("puts the link on the source line", () => {
    const message = quoteForChat({
      text: "one",
      source: "Deployment",
      url: "https://example.test/pr/12",
    });

    expect(message).toContain("From Deployment — https://example.test/pr/12");
  });

  it("trims a selection longer than the composer should hold, and shows that it did", () => {
    const message = quoteForChat({ text: "x".repeat(MAX_QUOTE_CHARS + 500) });

    expect(message).toContain("[…]");
    expect(message.length).toBeLessThan(MAX_QUOTE_CHARS + 100);
  });
});

describe("questionForArtifact", () => {
  it("names the artifact and links to it", () => {
    const message = questionForArtifact({
      title: "Fix the login redirect",
      url: "https://github.com/acme/app/pull/12",
    });

    expect(message).toBe(
      "About **Fix the login redirect** in the Knowledge Base — https://github.com/acme/app/pull/12\n\nWhat should I know about it?",
    );
  });

  it("copes with an artifact that has neither a title nor a link", () => {
    const message = questionForArtifact({ title: null, url: null });

    expect(message).toBe(
      "About this artifact in the Knowledge Base\n\nWhat should I know about it?",
    );
  });

  it("never emits a source line with a stray separator", () => {
    expect(questionForArtifact({ title: "Only a title" })).not.toContain("—");
  });
});
