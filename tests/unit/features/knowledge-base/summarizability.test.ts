import { describe, it, expect } from "vitest";
import {
  MIN_SUMMARY_LINES,
  countContentLines,
  isEmptyContent,
  summariseBlockReason,
} from "../../../../src/features/knowledge-base/summarizability";
import type { ArtifactContent } from "../../../../src/features/knowledge-base/types";

function content(overrides: Partial<ArtifactContent> = {}): ArtifactContent {
  return { content: "", mimeType: "text/plain", isObjectUrl: false, ...overrides };
}

describe("countContentLines", () => {
  it("counts only the lines that carry something", () => {
    expect(countContentLines("one\n\n  \ntwo\n")).toBe(2);
  });

  it("treats a file of blank lines as empty", () => {
    expect(countContentLines("\n\n \n\t\n")).toBe(0);
  });

  it("counts Windows and Unix line breaks the same way", () => {
    expect(countContentLines("one\r\ntwo\r\nthree")).toBe(3);
  });
});

describe("isEmptyContent", () => {
  it("is false while the content is still loading", () => {
    expect(isEmptyContent(null)).toBe(false);
  });

  it("is true for blank text, whatever the line breaks", () => {
    expect(isEmptyContent(content({ content: "" }))).toBe(true);
    expect(isEmptyContent(content({ content: " \n\n\t\n" }))).toBe(true);
  });

  it("is false as soon as a single line carries something", () => {
    expect(isEmptyContent(content({ content: "one line" }))).toBe(false);
  });

  it("never claims a format it cannot read is empty", () => {
    expect(
      isEmptyContent(
        content({ content: "blob:x", mimeType: "application/pdf", isObjectUrl: true }),
      ),
    ).toBe(false);
    expect(isEmptyContent(content({ content: "", mimeType: "image/png", isObjectUrl: true }))).toBe(
      false,
    );
  });
});

describe("summariseBlockReason", () => {
  it("says nothing while the content is still loading", () => {
    expect(summariseBlockReason(null)).toBeNull();
  });

  it("refuses empty content", () => {
    expect(summariseBlockReason(content({ content: " \n\n" }))).toMatch(/empty/i);
  });

  it("refuses content under the line floor, and says how short it is", () => {
    expect(summariseBlockReason(content({ content: "one\ntwo" }))).toMatch(/2 lines of content/);
    expect(summariseBlockReason(content({ content: "one" }))).toMatch(/1 line of content/);
  });

  it("allows content at the floor", () => {
    const text = Array.from({ length: MIN_SUMMARY_LINES }, (_, i) => `line ${i + 1}`).join("\n");
    expect(summariseBlockReason(content({ content: text }))).toBeNull();
  });

  it("never judges formats that are not text", () => {
    expect(
      summariseBlockReason(
        content({ content: "blob:x", mimeType: "application/pdf", isObjectUrl: true }),
      ),
    ).toBeNull();
    expect(
      summariseBlockReason(
        content({ content: "blob:x", mimeType: "image/png", isObjectUrl: true }),
      ),
    ).toBeNull();
  });
});
