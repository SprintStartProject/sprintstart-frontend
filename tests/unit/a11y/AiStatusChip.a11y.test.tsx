import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ArtifactList } from "../../../src/features/knowledge-base/components/ArtifactList";
import type { Artifact, ArtifactAiStatus } from "../../../src/features/knowledge-base/types";

const STATUSES: ArtifactAiStatus[] = ["INDEXED", "PROCESSING", "FAILED", "DEINDEXED", "UNKNOWN"];

function makeArtifact(id: string): Artifact {
  return {
    id,
    title: `${id}.md`,
    artifactType: "FILE",
    sourceSystem: "UPLOAD",
    sourceId: `up-${id}`,
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2024-01-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: null,
    ingestionRunId: null,
  };
}

describe("AI status chip a11y", () => {
  it("has no violations with every status on screen, in and out of select mode", async () => {
    const artifacts = STATUSES.map((status) => makeArtifact(status.toLowerCase()));
    const aiStatuses = new Map(STATUSES.map((status) => [status.toLowerCase(), status]));

    const { baseElement, rerender } = render(
      <main>
        <ArtifactList artifacts={artifacts} onSelect={vi.fn()} aiStatuses={aiStatuses} />
      </main>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();

    rerender(
      <main>
        <ArtifactList
          artifacts={artifacts}
          onSelect={vi.fn()}
          aiStatuses={aiStatuses}
          selection={{ selectedIds: new Set(["failed"]), onToggle: vi.fn() }}
        />
      </main>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
