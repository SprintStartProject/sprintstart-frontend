import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ArchiveDialog,
  DeleteItemDialog,
  DraftPromptDialog,
  LifecycleDialog,
} from "../../../../src/features/blueprints/components/BlueprintPathDialogs.tsx";
import type { BlueprintPath } from "../../../../src/features/blueprints/types.ts";

function pathOf(status: BlueprintPath["status"], version = 3): BlueprintPath {
  return { id: "p", status, version } as unknown as BlueprintPath;
}

describe("DeleteItemDialog", () => {
  const pending = { kind: "step", id: "s1", label: "Read the docs" } as const;

  it("names the item and what goes with it", () => {
    render(
      <DeleteItemDialog
        pendingDelete={pending}
        deletingId={null}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete step "Read the docs"?')).toBeInTheDocument();
    expect(screen.getByText(/Its tasks, resources/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete step" })).toBeInTheDocument();
  });

  it("confirms and cancels", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeleteItemDialog
        pendingDelete={pending}
        deletingId={null}
        error="nope"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("nope")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete step" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows nothing when no delete is pending", () => {
    render(
      <DeleteItemDialog
        pendingDelete={null}
        deletingId={null}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });
});

describe("DraftPromptDialog", () => {
  it("offers the next draft of a published version", () => {
    const onConfirm = vi.fn();
    render(
      <DraftPromptDialog
        path={pathOf("ACTIVE", 3)}
        isOpen
        isBusy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("This version is published")).toBeInTheDocument();
    expect(screen.getByText(/Opening draft v4 leaves v3 published/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open draft v4" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("only lets the author close it for an archived version", () => {
    render(
      <DraftPromptDialog
        path={pathOf("ARCHIVED")}
        isOpen
        isBusy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("This version is archived")).toBeInTheDocument();
    expect(screen.getByText(/Archived versions are kept as they were/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();
  });
});

describe("ArchiveDialog", () => {
  it("explains the consequence and confirms", () => {
    const onConfirm = vi.fn();
    render(<ArchiveDialog isOpen isBusy={false} onClose={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText("Archive this blueprint?")).toBeInTheDocument();
    expect(screen.getByText(/New hires stop being given this path/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("LifecycleDialog", () => {
  it("asks about the action it was given, naming the version", () => {
    const onConfirm = vi.fn();
    render(
      <LifecycleDialog
        pending={{ action: "publish", version: pathOf("DRAFT", 5) }}
        isBusy={false}
        error="failed"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("Publish version 5?")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("asks about deleting a draft", () => {
    render(
      <LifecycleDialog
        pending={{ action: "delete-draft", version: pathOf("DRAFT", 2) }}
        isBusy={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Delete draft version 2?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeInTheDocument();
  });

  it("shows nothing when no action is pending", () => {
    render(
      <LifecycleDialog
        pending={null}
        isBusy={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
