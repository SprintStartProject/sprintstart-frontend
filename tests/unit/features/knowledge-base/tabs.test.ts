import { describe, expect, it } from "vitest";
import { matchesFormat } from "../../../../src/features/knowledge-base/tabs";
import type { Artifact } from "../../../../src/features/knowledge-base/types";

/** An upload as the backend sends it: no mime, UUID source id, title + language only. */
function upload(title: string, language: string | null): Artifact {
  return {
    id: title,
    title,
    artifactType: "FILE",
    sourceSystem: "UPLOAD",
    sourceId: "4b1c7a2e-0000-0000-0000-000000000000",
    sourceUrl: null,
    mime: null,
    language,
    ingestedAt: "2026-09-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: null,
    ingestionRunId: null,
  };
}

describe("matchesFormat with the backend's language", () => {
  it("classifies a Markdown upload by language when the title has no extension", () => {
    const notes = upload("Team notes", "Markdown");
    expect(matchesFormat(notes, "MARKDOWN")).toBe(true);
    expect(matchesFormat(notes, "OTHER")).toBe(false);
  });

  it("files code and plain text under Other, not Markdown", () => {
    for (const artifact of [upload("Main.kt", "Kotlin"), upload("todo.txt", "Plain Text")]) {
      expect(matchesFormat(artifact, "MARKDOWN")).toBe(false);
      expect(matchesFormat(artifact, "OTHER")).toBe(true);
    }
  });

  it("still classifies by extension when the language is missing", () => {
    expect(matchesFormat(upload("README.md", null), "MARKDOWN")).toBe(true);
    expect(matchesFormat(upload("spec.pdf", null), "PDF")).toBe(true);
  });
});
