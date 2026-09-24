import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { BlueprintPathDetailPage } from "../../../src/pages/BlueprintPathDetailPage.tsx";
import type { BlueprintPath } from "../../../src/features/blueprints/types.ts";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getPath: vi.fn(),
    getGraph: vi.fn(),
    deletePhase: vi.fn(),
    publishPath: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  },
}));

vi.mock("../../../src/context/useAuth.ts", () => ({
  useAuth: () => ({ profile: { permissionGroup: "PM" } }),
}));

vi.mock("../../../src/features/projects/useProjectContext.ts", () => ({
  useProjectContext: () => ({ selectedProjectId: "project-1", isLoading: false }),
}));

vi.mock("../../../src/context/useToast.ts", () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: mocks.toastError }),
}));

vi.mock("../../../src/services/blueprintService.ts", () => ({
  blueprintService: {
    getPath: mocks.getPath,
    getGraph: mocks.getGraph,
    deletePhase: mocks.deletePhase,
    publishPath: mocks.publishPath,
  },
}));

function pathFixture(status: BlueprintPath["status"] = "DRAFT"): BlueprintPath {
  return {
    id: "path-1",
    blueprintKey: "key-1",
    projectId: "project-1",
    version: 3,
    revision: 0,
    status,
    title: "Backend onboarding",
    description: "",
    blueprintPhases: [
      {
        id: "phase-1",
        blueprintPathId: "path-1",
        revision: 0,
        position: 0,
        title: "Get set up",
        description: "",
        type: "FIXED",
        aiPrompt: null,
        graphX: 0,
        graphY: 0,
        blockerIds: [],
        requirements: [],
        blueprintSteps: [],
        blueprintCheckQuestions: [],
      },
    ],
  } as unknown as BlueprintPath;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/blueprints/path-1"]}>
      <Routes>
        <Route path="/blueprints/:pathId" element={<BlueprintPathDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BlueprintPathDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPath.mockResolvedValue(pathFixture());
    mocks.getGraph.mockResolvedValue({
      nodes: [
        { id: "phase-1", revision: 0, title: "Get set up", graphX: 0, graphY: 0, blockerIds: [] },
      ],
    });
  });

  /**
   * A delete that failed used to read as one that succeeded: the page caught everything, so the
   * promise resolved, the dialog closed and the phase was still there.
   */
  it("says a delete failed instead of reporting it as done", async () => {
    const user = userEvent.setup();
    mocks.deletePhase.mockRejectedValue(new Error("This version has moved on"));

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete phase Get set up" }));
    await user.click(await screen.findByRole("button", { name: "Delete phase" }));

    // In the dialog, where the decision was made -- the page's own error bar says it too, but
    // that one renders behind the open overlay.
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText("This version has moved on")).toBeInTheDocument();
    // Still asking, and the phase is still on the page.
    expect(screen.getByRole("button", { name: "Delete phase" })).toBeInTheDocument();
    expect(screen.getByText("Get set up")).toBeInTheDocument();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("removes the phase on a delete that worked", async () => {
    const user = userEvent.setup();
    mocks.deletePhase.mockResolvedValue({ updatedPhases: [] });

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete phase Get set up" }));
    await user.click(await screen.findByRole("button", { name: "Delete phase" }));

    await waitFor(() => expect(screen.queryByText("Get set up")).not.toBeInTheDocument());
  });

  /**
   * Publishing swaps what every new hire is handed, and is the one action here that people outside
   * the team see. It used to go straight out on a single click.
   */
  it("asks before publishing, and only publishes once", async () => {
    const user = userEvent.setup();
    mocks.publishPath.mockReturnValue(new Promise(() => {}));

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Publish" }));
    expect(mocks.publishPath).not.toHaveBeenCalled();

    expect(await screen.findByText("Publish version 3?")).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Publish" })[1];
    await user.click(confirm);
    await user.click(confirm);

    expect(mocks.publishPath).toHaveBeenCalledTimes(1);
  });
});
