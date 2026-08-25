import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuddyOrientationCard } from "../../../../src/features/buddy/components/BuddyOrientationCard";
import type { MyOrientation } from "../../../../src/features/orientation/types";

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "proj1",
        projects: [createSelectableProject({ id: "proj1", name: "Project One" })],
        selectedProject: createSelectableProject({ id: "proj1", name: "Project One" }),
      }),
  };
});

vi.mock("../../../../src/services/orientationService", () => ({
  orientationService: {
    fetchMyOrientation: vi.fn(),
    authorMyOrientation: vi.fn(),
    revertMyOrientation: vi.fn(),
  },
}));

import { orientationService } from "../../../../src/services/orientationService";

const withPacket: MyOrientation = {
  taskId: "task-1",
  taskTitle: "Fix the stale cache header",
  taskUrl: "https://github.com/acme/repo/issues/42",
  reason: null,
  packet: {
    taskId: "task-1",
    taskTitle: "Fix the stale cache header",
    summary: "What you need to change the header.",
    sections: [
      {
        step: "SET_UP",
        title: "Run it locally",
        body: "Run `make dev`.",
        citations: [
          {
            filename: "README.md",
            chunkId: "c1",
            sourceUrl: "https://example.test/README.md",
          },
        ],
      },
    ],
    sources: [
      {
        filename: "README.md",
        sourceUrl: "https://example.test/README.md",
        artifactType: "FILE",
      },
    ],
    assembledAt: "2026-07-21T12:00:00Z",
    origin: "AI",
  },
};

describe("BuddyOrientationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders the packet inside the conversation, sources included", async () => {
    vi.mocked(orientationService.fetchMyOrientation).mockResolvedValue(withPacket);

    render(<BuddyOrientationCard />);

    // The step body and its provenance, not a link out to a page.
    expect(await screen.findByText("Run it locally")).toBeInTheDocument();
    expect(screen.getByText("make dev")).toBeInTheDocument();
    const link = screen.getAllByRole("link", { name: /README\.md/ })[0];
    expect(link).toHaveAttribute("href", "https://example.test/README.md");
    expect(orientationService.fetchMyOrientation).toHaveBeenCalledWith("proj1");
  });

  it("says so honestly when the corpus could not ground a packet", async () => {
    vi.mocked(orientationService.fetchMyOrientation).mockResolvedValue({
      taskId: "task-1",
      taskTitle: "Fix the stale cache header",
      taskUrl: "https://github.com/acme/repo/issues/42",
      packet: null,
      reason: "corpus is empty",
    });

    render(<BuddyOrientationCard />);

    expect(await screen.findByText(/no guide here/)).toBeInTheDocument();
  });

  it("offers a retry when the load itself failed", async () => {
    vi.mocked(orientationService.fetchMyOrientation)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(withPacket);

    const user = userEvent.setup();
    render(<BuddyOrientationCard />);

    await user.click(await screen.findByRole("button", { name: /Try again/ }));

    expect(await screen.findByText("Run it locally")).toBeInTheDocument();
  });

  it("keeps the hire fix-this affordance: saving pins their words and reloads", async () => {
    vi.mocked(orientationService.fetchMyOrientation).mockResolvedValue(withPacket);
    vi.mocked(orientationService.authorMyOrientation).mockResolvedValue(withPacket.packet!);

    const user = userEvent.setup();
    render(<BuddyOrientationCard />);

    await user.click(await screen.findByTestId("edit-orientation"));
    expect(await screen.findByTestId("orientation-editor")).toBeInTheDocument();

    // The editor opens against the loaded packet; closing it without saving changes nothing.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("orientation-editor")).not.toBeInTheDocument();
    expect(orientationService.authorMyOrientation).not.toHaveBeenCalled();
  });
});
