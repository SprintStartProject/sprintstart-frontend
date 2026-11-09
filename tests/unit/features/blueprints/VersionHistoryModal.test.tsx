import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionHistoryModal } from "../../../../src/features/blueprints/components/VersionHistoryModal.tsx";
import { blueprintAddress } from "../../../../src/features/blueprints/pathPageContext.ts";
import type { LifecycleActions } from "../../../../src/features/blueprints/useLifecycleActions.ts";
import type { VersionHistory } from "../../../../src/features/blueprints/useVersionHistory.ts";
import type { BlueprintPath } from "../../../../src/features/blueprints/types.ts";

function version(id: string, number: number, status: BlueprintPath["status"], description = "") {
  return { id, version: number, status, description } as BlueprintPath;
}

function historyOf(overrides: Partial<VersionHistory> = {}): VersionHistory {
  return {
    isOpen: true,
    versions: [
      version("v3", 3, "DRAFT", "In progress"),
      version("v2", 2, "ACTIVE"),
      version("v1", 1, "ARCHIVED", "First"),
    ],
    isLoading: false,
    open: vi.fn(),
    close: vi.fn(),
    drop: vi.fn(),
    ...overrides,
  };
}

function lifecycleOf(overrides: Partial<LifecycleActions> = {}): LifecycleActions {
  return {
    pending: null,
    isBusy: false,
    error: null,
    request: vi.fn(),
    cancel: vi.fn(),
    run: vi.fn(),
    ...overrides,
  };
}

describe("VersionHistoryModal", () => {
  it("lists every version with its status and description", () => {
    render(
      <VersionHistoryModal
        history={historyOf()}
        lifecycle={lifecycleOf()}
        onOpenVersion={vi.fn()}
      />,
    );
    expect(screen.getByText("Version 3")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("No description")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("opens the version that was picked", () => {
    const onOpenVersion = vi.fn();
    render(
      <VersionHistoryModal
        history={historyOf()}
        lifecycle={lifecycleOf()}
        onOpenVersion={onOpenVersion}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Version 2/ }));
    expect(onOpenVersion).toHaveBeenCalledWith(expect.objectContaining({ id: "v2" }));
  });

  it("offers deletion for drafts only, and asks the lifecycle to confirm it", () => {
    const lifecycle = lifecycleOf();
    render(
      <VersionHistoryModal history={historyOf()} lifecycle={lifecycle} onOpenVersion={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Delete draft version 2" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete draft version 3" }));
    expect(lifecycle.request).toHaveBeenCalledWith({
      action: "delete-draft",
      version: expect.objectContaining<Partial<BlueprintPath>>({ id: "v3" }) as BlueprintPath,
    });
  });

  it("marks only the draft being deleted as busy", () => {
    render(
      <VersionHistoryModal
        history={historyOf({
          versions: [version("v3", 3, "DRAFT"), version("v4", 4, "DRAFT")],
        })}
        lifecycle={lifecycleOf({
          isBusy: true,
          pending: { action: "delete-draft", version: version("v3", 3, "DRAFT") },
        })}
        onOpenVersion={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Delete draft version 3" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Delete draft version 4" })).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows a loading line instead of the list while loading", () => {
    render(
      <VersionHistoryModal
        history={historyOf({ isLoading: true })}
        lifecycle={lifecycleOf()}
        onOpenVersion={vi.fn()}
      />,
    );
    expect(screen.getByText(/Loading versions/)).toBeInTheDocument();
    expect(screen.queryByText("Version 3")).not.toBeInTheDocument();
  });

  it("is hidden while closed", () => {
    render(
      <VersionHistoryModal
        history={historyOf({ isOpen: false })}
        lifecycle={lifecycleOf()}
        onOpenVersion={vi.fn()}
      />,
    );
    expect(screen.queryByText("Version history")).not.toBeInTheDocument();
  });
});

describe("blueprintAddress", () => {
  it("addresses a version in the project scope", () => {
    expect(blueprintAddress("abc", false)).toBe("/blueprints/abc");
  });

  it("keeps the global scope", () => {
    expect(blueprintAddress("abc", true)).toBe("/blueprints/abc?scope=global");
  });
});
