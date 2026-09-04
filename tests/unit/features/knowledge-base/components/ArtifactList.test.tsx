import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArtifactList } from "../../../../../src/features/knowledge-base/components/ArtifactList";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "a1",
    title: "readme.md",
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: "src",
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2026-08-01T10:00:00Z",
    lastChangedAt: null,
    contentHash: null,
    ingestionRunId: null,
    ...overrides,
  };
}

describe("ArtifactList", () => {
  /*
    A body-only edit changes neither the title nor the ingest date, so the row gave no sign that
    a repository update had brought anything in. "Changed" is that sign.
  */
  it("shows when an artifact's content last changed", () => {
    render(
      <ArtifactList
        artifacts={[makeArtifact({ lastChangedAt: "2026-08-21T12:00:00Z" })]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(/Changed:/)).toBeInTheDocument();
  });

  it("says nothing about changes for an artifact still matching its import", () => {
    render(<ArtifactList artifacts={[makeArtifact({ lastChangedAt: null })]} onSelect={vi.fn()} />);

    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText(/Ingested:/)).toBeInTheDocument();
    expect(screen.queryByText(/Changed:/)).not.toBeInTheDocument();
  });
});
