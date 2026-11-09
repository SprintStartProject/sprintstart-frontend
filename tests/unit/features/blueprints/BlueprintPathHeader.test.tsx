import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlueprintPathHeader } from "../../../../src/features/blueprints/components/BlueprintPathHeader.tsx";
import type { BlueprintPath } from "../../../../src/features/blueprints/types.ts";

function pathOf(status: BlueprintPath["status"], description = "About it") {
  return { id: "p", title: "Backend onboarding", description, version: 4, status } as BlueprintPath;
}

function renderHeader(status: BlueprintPath["status"], overrides = {}) {
  const handlers = {
    onBack: vi.fn(),
    onOpenHistory: vi.fn(),
    onArchive: vi.fn(),
    onEditAsDraft: vi.fn(),
    onRevert: vi.fn(),
    onPublish: vi.fn(),
  };
  render(
    <BlueprintPathHeader
      path={pathOf(status)}
      isArchiving={false}
      isLifecycleBusy={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("BlueprintPathHeader", () => {
  it("names the blueprint and the version being looked at", () => {
    renderHeader("DRAFT");
    expect(screen.getByText("Backend onboarding")).toBeInTheDocument();
    expect(screen.getByText("About it")).toBeInTheDocument();
    expect(screen.getByText("Draft · v4")).toBeInTheDocument();
  });

  it("says so when there is no description", () => {
    render(
      <BlueprintPathHeader
        path={pathOf("DRAFT", "")}
        isArchiving={false}
        isLifecycleBusy={false}
        onBack={vi.fn()}
        onOpenHistory={vi.fn()}
        onArchive={vi.fn()}
        onEditAsDraft={vi.fn()}
        onRevert={vi.fn()}
        onPublish={vi.fn()}
      />,
    );
    expect(screen.getByText("No path description yet.")).toBeInTheDocument();
  });

  it("goes back and opens the history", () => {
    const handlers = renderHeader("DRAFT");
    fireEvent.click(screen.getByRole("button", { name: "All blueprints" }));
    fireEvent.click(screen.getByRole("button", { name: "Version history" }));
    expect(handlers.onBack).toHaveBeenCalledOnce();
    expect(handlers.onOpenHistory).toHaveBeenCalledOnce();
  });

  it("offers only Publish on a draft", () => {
    const handlers = renderHeader("DRAFT");
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(handlers.onPublish).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit as draft" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revert to this version" }),
    ).not.toBeInTheDocument();
  });

  it("offers Archive and Edit as draft on the published version", () => {
    const handlers = renderHeader("ACTIVE");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit as draft" }));
    expect(handlers.onArchive).toHaveBeenCalledOnce();
    expect(handlers.onEditAsDraft).toHaveBeenCalledOnce();
    expect(screen.getByText("Published · v4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("offers only Revert on an archived version", () => {
    const handlers = renderHeader("ARCHIVED");
    fireEvent.click(screen.getByRole("button", { name: "Revert to this version" }));
    expect(handlers.onRevert).toHaveBeenCalledOnce();
    expect(screen.getByText("Archived · v4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("disables Publish and Revert while a lifecycle action is running", () => {
    renderHeader("DRAFT", { isLifecycleBusy: true });
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("disables Revert while a lifecycle action is running", () => {
    renderHeader("ARCHIVED", { isLifecycleBusy: true });
    expect(screen.getByRole("button", { name: "Revert to this version" })).toBeDisabled();
  });

  it("shows Archive as busy while archiving", () => {
    renderHeader("ACTIVE", { isArchiving: true });
    expect(screen.getByRole("button", { name: /Archive/ })).toHaveAttribute("aria-busy", "true");
  });
});
