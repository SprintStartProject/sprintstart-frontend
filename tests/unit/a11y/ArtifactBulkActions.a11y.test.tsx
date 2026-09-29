import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ArtifactList } from "../../../src/features/knowledge-base/components/ArtifactList";
import { ArtifactBulkActions } from "../../../src/features/knowledge-base/components/ArtifactBulkActions";
import type { Artifact } from "../../../src/features/knowledge-base/types";
import { knowledgeService } from "../../../src/services/knowledgeService";

function makeArtifact(id: string, title: string, sourceSystem: Artifact["sourceSystem"]): Artifact {
  return {
    id,
    title,
    artifactType: "FILE",
    sourceSystem,
    sourceId: `up-${id}`,
    sourceUrl: null,
    mime: null,
    language: null,
    ingestedAt: "2026-09-01T10:00:00Z",
    lastChangedAt: null,
    contentHash: null,
    ingestionRunId: null,
  };
}

const upload = makeArtifact("u1", "notes.pdf", "UPLOAD");
const other = makeArtifact("u2", "plan.md", "UPLOAD");

afterEach(() => vi.restoreAllMocks());

describe("bulk delete a11y", () => {
  it("has no violations in select mode, with the toolbar and a mixed outcome", async () => {
    vi.spyOn(knowledgeService, "deleteUploads").mockResolvedValue({
      deletedIds: ["up-u1"],
      failed: [{ artifactId: "up-u2", error: "Artifact could not be deleted." }],
    });
    const github = makeArtifact("g1", "gh.md", "GITHUB");
    const { baseElement } = render(
      <main>
        <ArtifactBulkActions
          projectId="p1"
          removerId="user-1"
          selected={[upload, other]}
          onClearSelection={vi.fn()}
          onDeleted={vi.fn()}
          listScopeKey="scope-1"
        />
        <ArtifactList
          artifacts={[upload, other, github]}
          onSelect={vi.fn()}
          selection={{ selectedIds: new Set(["u1", "u2"]), onToggle: vi.fn() }}
        />
      </main>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();

    fireEvent.click(screen.getByTestId("kb-bulk-delete"));
    expect(await axe(baseElement)).toHaveNoViolations();

    fireEvent.click(screen.getByTestId("kb-bulk-confirm"));
    await screen.findByTestId("kb-bulk-failed");
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
