import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MyKnowledgeGapsProvider } from "../../../../src/features/knowledge-gaps/MyKnowledgeGapsProvider";
import { useMyKnowledgeGaps } from "../../../../src/features/knowledge-gaps/useMyKnowledgeGaps";
import type { KnowledgeGap } from "../../../../src/features/knowledge-gaps/types";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    status: "authenticated",
    projectId: "p1",
    /** Whether the loaded project list contains `projectId` (see `ProjectProvider`). */
    selected: true,
    fetchMyKnowledgeGaps: vi.fn(),
  },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({ status: mocks.status, profile: { id: "u1" } }),
}));

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProjectId: mocks.projectId,
    selectedProject: mocks.selected && mocks.projectId ? { id: mocks.projectId } : null,
    hasSelectedProject: mocks.selected && !!mocks.projectId,
  }),
}));

vi.mock("../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: { fetchMyKnowledgeGaps: mocks.fetchMyKnowledgeGaps },
}));

const gap = (component: string, severity: KnowledgeGap["severity"] = "high"): KnowledgeGap => ({
  id: `gap-${component}`,
  component,
  missingTypes: ["runbook"],
  lastIngested: "2026-08-01T00:00:00Z",
  refreshedAt: "2026-08-10T00:00:00Z",
  owners: [],
  severity,
});

/** Reports what the three consumers of this context actually read off it. */
function Probe() {
  const { gaps, unseenComponents, markAllSeen } = useMyKnowledgeGaps();

  return (
    <div>
      <span data-testid="gaps">{gaps.map((entry) => entry.component).join(",")}</span>
      <span data-testid="unseen">{unseenComponents.join(",")}</span>
      <button type="button" onClick={markAllSeen}>
        Mark all seen
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <MyKnowledgeGapsProvider>
      <Probe />
    </MyKnowledgeGapsProvider>,
  );

describe("MyKnowledgeGapsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.status = "authenticated";
    mocks.projectId = "p1";
    mocks.selected = true;
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({ gaps: [] });
  });

  // The overview is the project's full component roster. A covered component was scanned and
  // found to be missing nothing, so it is not a smaller item -- it is not an item.
  it("drops the components that are missing nothing", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [gap("auth-service"), gap("billing", "covered")],
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("gaps")).toHaveTextContent("auth-service"));
    expect(screen.getByTestId("gaps")).not.toHaveTextContent("billing");
  });

  it("counts everything as unseen until it is acknowledged", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [gap("acme/one"), gap("acme/two")],
    });

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("unseen")).toHaveTextContent("acme/one,acme/two"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Mark all seen" }));

    expect(screen.getByTestId("unseen")).toHaveTextContent("");
    // Written through, so the marker does not come back on the next load.
    expect(
      JSON.parse(window.localStorage.getItem("sprintstart:knowledge-gap-owner-seen:u1") ?? "[]"),
    ).toEqual(["acme/one", "acme/two"]);
  });

  it("treats a component nobody has acknowledged yet as new, even beside one they have", async () => {
    window.localStorage.setItem(
      "sprintstart:knowledge-gap-owner-seen:u1",
      JSON.stringify(["acme/one"]),
    );
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [gap("acme/one"), gap("acme/two")],
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("unseen")).toHaveTextContent("acme/two"));
    expect(screen.getByTestId("unseen")).not.toHaveTextContent("acme/one");
  });

  // The endpoint is scoped to a project and answers 400 without one, which is not a failure
  // worth showing anybody.
  it("asks nothing at all without a selected project", async () => {
    mocks.projectId = "";

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("gaps")).toBeEmptyDOMElement());
    expect(mocks.fetchMyKnowledgeGaps).not.toHaveBeenCalled();
  });

  // The ID comes back from storage before the project list has resolved, so a non-empty
  // selection is not yet evidence that this user can reach that project.
  it("asks nothing at all for a selection the project list has not confirmed", async () => {
    mocks.selected = false;

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("gaps")).toBeEmptyDOMElement());
    expect(mocks.fetchMyKnowledgeGaps).not.toHaveBeenCalled();
  });

  it("asks nothing at all while nobody is signed in", async () => {
    mocks.status = "loading";

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("gaps")).toBeEmptyDOMElement());
    expect(mocks.fetchMyKnowledgeGaps).not.toHaveBeenCalled();
  });
  it("loads the selected project's gaps once authentication settles", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    });
    mocks.status = "loading";
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [gap("acme/service")],
    });

    const tree = () => (
      <QueryClientProvider client={client}>
        <MyKnowledgeGapsProvider>
          <Probe />
        </MyKnowledgeGapsProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(tree());

    expect(mocks.fetchMyKnowledgeGaps).not.toHaveBeenCalled();

    mocks.status = "authenticated";
    rerender(tree());

    await waitFor(() => expect(screen.getByTestId("gaps")).toHaveTextContent("acme/service"));
    expect(mocks.fetchMyKnowledgeGaps).toHaveBeenCalledWith("p1");
  });
});
