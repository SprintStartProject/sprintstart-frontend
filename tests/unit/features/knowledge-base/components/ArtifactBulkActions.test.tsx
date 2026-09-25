import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactBulkActions } from "../../../../../src/features/knowledge-base/components/ArtifactBulkActions";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";
import { knowledgeService } from "../../../../../src/services/knowledgeService";

function makeUpload(id: string, title: string): Artifact {
  return {
    id,
    title,
    artifactType: "FILE",
    sourceSystem: "UPLOAD",
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

const selected = [makeUpload("a1", "notes.pdf"), makeUpload("a2", "plan.md")];

function renderActions(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  const rerender = (next: ReactElement) =>
    view.rerender(<QueryClientProvider client={client}>{next}</QueryClientProvider>);
  return { invalidate, rerender };
}

function props(overrides: Partial<Parameters<typeof ArtifactBulkActions>[0]> = {}) {
  return {
    projectId: "p1",
    removerId: "user-1",
    selected,
    onClearSelection: vi.fn(),
    onDeleted: vi.fn(),
    listScopeKey: "scope-1",
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("ArtifactBulkActions", () => {
  it("shows no toolbar while nothing is ticked", () => {
    renderActions(<ArtifactBulkActions {...props({ selected: [] })} />);
    expect(screen.queryByTestId("kb-bulk-toolbar")).not.toBeInTheDocument();
  });

  it("says how many uploads are ticked and clears on request", () => {
    const onClearSelection = vi.fn();
    renderActions(<ArtifactBulkActions {...props({ onClearSelection })} />);

    expect(screen.getByTestId("kb-bulk-toolbar")).toHaveTextContent("2 uploads selected");
    fireEvent.click(screen.getByTestId("kb-bulk-clear"));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("deletes every ticked upload in one request and reports the count", async () => {
    const deleteUploads = vi
      .spyOn(knowledgeService, "deleteUploads")
      .mockResolvedValue({ deletedIds: ["up-a1", "up-a2"], failed: [] });
    const onDeleted = vi.fn();
    const { invalidate } = renderActions(<ArtifactBulkActions {...props({ onDeleted })} />);

    fireEvent.click(screen.getByTestId("kb-bulk-delete"));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("and their indexed content");
    fireEvent.click(screen.getByTestId("kb-bulk-confirm"));

    expect(await screen.findByTestId("kb-bulk-deleted")).toHaveTextContent("2 deleted");
    expect(deleteUploads).toHaveBeenCalledWith("p1", ["up-a1", "up-a2"], "user-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["knowledge-base", "p1"] });
    expect(onDeleted).toHaveBeenCalledWith(["a1", "a2"]);
    expect(screen.queryByTestId("kb-bulk-failed")).not.toBeInTheDocument();
  });

  it("drops the delete report once the reader moves to another list", async () => {
    vi.spyOn(knowledgeService, "deleteUploads").mockResolvedValue({
      deletedIds: ["up-a1"],
      failed: [{ artifactId: "up-a2", error: "Locked" }],
    });
    const { rerender } = renderActions(<ArtifactBulkActions {...props()} />);

    fireEvent.click(screen.getByTestId("kb-bulk-delete"));
    fireEvent.click(screen.getByTestId("kb-bulk-confirm"));
    expect(await screen.findByTestId("kb-bulk-deleted")).toHaveTextContent("1 deleted");

    // Same list (the delete's own refetch): the report stays.
    rerender(<ArtifactBulkActions {...props()} />);
    expect(screen.getByTestId("kb-bulk-failed")).toBeInTheDocument();

    rerender(<ArtifactBulkActions {...props({ listScopeKey: "scope-2" })} />);
    expect(screen.queryByTestId("kb-bulk-deleted")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kb-bulk-failed")).not.toBeInTheDocument();
  });

  it("names each upload that could not be deleted, with its reason", async () => {
    vi.spyOn(knowledgeService, "deleteUploads").mockResolvedValue({
      deletedIds: ["up-a1"],
      failed: [{ artifactId: "up-a2", error: "Artifact could not be deleted." }],
    });
    const onDeleted = vi.fn();
    renderActions(<ArtifactBulkActions {...props({ onDeleted })} />);

    fireEvent.click(screen.getByTestId("kb-bulk-delete"));
    fireEvent.click(screen.getByTestId("kb-bulk-confirm"));

    const failed = await screen.findByRole("alert");
    expect(failed).toHaveTextContent("1 upload could not be deleted");
    expect(failed).toHaveTextContent("plan.md: Artifact could not be deleted.");
    expect(screen.getByTestId("kb-bulk-deleted")).toHaveTextContent("1 deleted");
    expect(onDeleted).toHaveBeenCalledWith(["a1"]);
  });

  it("keeps the dialog open with the reason when the request itself fails", async () => {
    vi.spyOn(knowledgeService, "deleteUploads").mockRejectedValue(new Error("Forbidden"));
    const onDeleted = vi.fn();
    renderActions(<ArtifactBulkActions {...props({ onDeleted })} />);

    fireEvent.click(screen.getByTestId("kb-bulk-delete"));
    fireEvent.click(screen.getByTestId("kb-bulk-confirm"));

    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("Forbidden"));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.queryByTestId("kb-bulk-deleted")).not.toBeInTheDocument();
  });
});
