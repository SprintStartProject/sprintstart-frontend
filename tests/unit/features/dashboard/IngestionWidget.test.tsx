import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { IngestionWidget } from "../../../../src/features/dashboard/components/IngestionWidget";
import { createProjectContextValue, createSelectableProject } from "../../setup/projectContext";
import type { ProjectContextValue } from "../../../../src/features/projects/ProjectContext";

const { mocks } = vi.hoisted(() => {
  const mocks: {
    projectContext: ProjectContextValue | null;
    getIngestionSourceStatuses: ReturnType<typeof vi.fn>;
  } = {
    projectContext: null,
    getIngestionSourceStatuses: vi.fn(),
  };

  return { mocks };
});

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.projectContext,
}));

vi.mock("../../../../src/services/ingestionService", () => ({
  getIngestionSourceStatuses: mocks.getIngestionSourceStatuses,
}));

function renderWidget(size: "small" | "medium" | "wide" = "medium") {
  render(
    <MemoryRouter>
      <IngestionWidget size={size} />
    </MemoryRouter>,
  );
}

describe("IngestionWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIngestionSourceStatuses.mockResolvedValue([]);
  });

  it("asks for the sources of the selected project", async () => {
    const project = createSelectableProject({ id: "1" });
    mocks.projectContext = createProjectContextValue({
      projects: [project],
      selectedProject: project,
      selectedProjectId: "1",
    });

    renderWidget();

    await waitFor(() => expect(mocks.getIngestionSourceStatuses).toHaveBeenCalledWith("1"));
    // An empty answer is a success, not a failure — the figures simply sit at zero.
    expect(screen.queryByText("Could not load the ingestion status.")).not.toBeInTheDocument();
  });

  it("does not ask for source statuses before a project is confirmed", () => {
    // The boot window: an id is absent, and no list has vouched for anything. Asking now
    // would send an empty `projectId` — an unfiltered, cross-project answer.
    mocks.projectContext = createProjectContextValue({
      projects: [],
      selectedProject: null,
      selectedProjectId: "",
    });

    renderWidget();

    expect(mocks.getIngestionSourceStatuses).not.toHaveBeenCalled();
    expect(screen.queryByText("Could not load the ingestion status.")).not.toBeInTheDocument();
  });

  it("does not ask about a deep-linked id no loaded list has confirmed", () => {
    // A `?projectId=` deep link publishes an id into the context before the project list
    // can vouch for it — the card must not relay it to the backend unchecked.
    mocks.projectContext = createProjectContextValue({
      projects: [],
      selectedProject: null,
      selectedProjectId: "unconfirmed-project",
    });

    renderWidget();

    expect(mocks.getIngestionSourceStatuses).not.toHaveBeenCalled();
    expect(screen.queryByText("Could not load the ingestion status.")).not.toBeInTheDocument();
  });
});
