import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPageMocks, service } from "./support/blueprintPathMocks.ts";
import { PROJECT_SCOPE, renderPage, richPath, servePath } from "./support/blueprintPathPage.tsx";

vi.mock("../../../src/context/useAuth.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return { useAuth: () => ({ profile: { permissionGroup: session.permissionGroup } }) };
});
vi.mock("../../../src/features/projects/useProjectContext.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return {
    useProjectContext: () => ({
      selectedProjectId: session.selectedProjectId,
      isLoading: session.isProjectLoading,
    }),
  };
});
vi.mock("../../../src/context/useToast.ts", async () => {
  const { toast } = await import("./support/blueprintPathMocks.ts");
  return { useToast: () => toast };
});
vi.mock("../../../src/services/blueprintService.ts", async () => {
  const { service } = await import("./support/blueprintPathMocks.ts");
  return { blueprintService: service };
});
vi.mock("../../../src/features/blueprints/components/BlueprintGraphEditor.tsx", async () => {
  const { GraphEditorStub } = await import("./support/graphEditorStubs.tsx");
  return { BlueprintGraphEditor: GraphEditorStub };
});
vi.mock("../../../src/features/blueprints/components/BlueprintSubGraphEditor.tsx", async () => {
  const { SubGraphEditorStub } = await import("./support/graphEditorStubs.tsx");
  return { BlueprintSubGraphEditor: SubGraphEditorStub };
});

type User = ReturnType<typeof userEvent.setup>;

const subGraphNodes = [
  {
    id: "step-1",
    revision: 2,
    title: "Clone the repo",
    graphX: 1,
    graphY: 2,
    blockerIds: [],
    type: "STEP",
    blueprintPhaseId: "phase-1",
  },
  {
    id: "step-2",
    revision: 1,
    title: "Build it",
    graphX: 3,
    graphY: 4,
    blockerIds: ["step-1"],
    type: "STEP",
    blueprintPhaseId: "phase-1",
  },
  {
    id: "q-1",
    revision: 5,
    title: "Q node",
    graphX: 5,
    graphY: 6,
    blockerIds: [],
    type: "QUESTION",
    blueprintPhaseId: "phase-1",
  },
];

function graphProps() {
  return JSON.parse(screen.getByTestId("graph-props").textContent ?? "{}") as {
    editable: boolean;
    pathTitle: string;
    openPhaseTitle: string | null;
    phases: {
      id: string;
      revision: number;
      x: number;
      y: number;
      blockerIds: string[];
      title: string;
    }[];
  };
}

function subProps() {
  return JSON.parse(screen.getByTestId("sub-graph-props").textContent ?? "{}") as {
    editable: boolean;
    phase: string;
    openNodeTitle: string | null;
    nodes: {
      id: string;
      revision: number;
      x: number;
      y: number;
      blockerIds: string[];
      title: string;
    }[];
    steps: string[];
    questions: string[];
  };
}

async function press(user: User, name: string) {
  await user.click(await screen.findByRole("button", { name }));
}

function results() {
  return JSON.parse(screen.getByTestId("results").textContent ?? "{}") as Record<string, string>;
}

async function resultOf(name: string) {
  await waitFor(() => expect(Object.keys(results())).toContain(name));
  return results()[name];
}

async function openGraph(user: User) {
  await user.click(await screen.findByRole("button", { name: "Graph" }));
  await screen.findByTestId("graph-editor");
}

async function openSubGraph(user: User) {
  await openGraph(user);
  await press(user, "open sub-graph");
  await screen.findByTestId("sub-graph-editor");
}

describe("BlueprintPathDetailPage graph editor", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
    service.getSubGraph.mockResolvedValue({ nodes: subGraphNodes });
  });

  it("hands the phases, in order, to an editor that can edit a draft", async () => {
    const user = userEvent.setup();
    renderPage();
    await openGraph(user);

    const props = graphProps();
    expect(props.editable).toBe(true);
    expect(props.pathTitle).toBe("Backend onboarding");
    expect(props.phases.map((phase) => phase.title)).toEqual(["Get set up", "Learn the domain"]);
    expect(props.openPhaseTitle).toBeNull();
    expect(screen.queryByText("Phase 1")).not.toBeInTheDocument();
  });

  it("makes the graph read-only on a published version", async () => {
    servePath(richPath("ACTIVE"));
    const user = userEvent.setup();
    renderPage();
    await openGraph(user);

    expect(graphProps().editable).toBe(false);
  });

  it("reports a graph that could not be loaded and stays in the outline", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });
    service.getGraph.mockRejectedValue(new Error("Graph is down"));

    await user.click(screen.getByRole("button", { name: "Graph" }));

    expect(await screen.findByText("Graph is down")).toBeInTheDocument();
    expect(screen.queryByTestId("graph-editor")).not.toBeInTheDocument();
  });

  it("uses a generic message when the graph failure carries none", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });
    service.getGraph.mockRejectedValue("nope");

    await user.click(screen.getByRole("button", { name: "Graph" }));

    expect(await screen.findByText("Blueprint graph could not be loaded.")).toBeInTheDocument();
  });

  it("opens a phase from the outline in the graph", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Open phase Get set up in the graph" }),
    );

    await screen.findByTestId("graph-editor");
    expect(graphProps().openPhaseTitle).toBe("Get set up");
    await press(user, "opened phase");
    await waitFor(() => expect(graphProps().openPhaseTitle).toBeNull());
  });

  it("saves a moved phase and shows its new place and revision", async () => {
    const user = userEvent.setup();
    service.updateGraphNodePosition.mockResolvedValue({
      revision: 2,
      graphX: 11,
      graphY: 22,
      blockerIds: [],
    });
    renderPage();
    await openGraph(user);

    await press(user, "move phase");

    await waitFor(() =>
      expect(service.updateGraphNodePosition).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", {
        revision: 1,
        graphX: 11,
        graphY: 22,
      }),
    );
    await waitFor(() =>
      expect(graphProps().phases[0]).toMatchObject({ revision: 2, x: 11, y: 22 }),
    );
  });

  it("adds and removes a prerequisite", async () => {
    const user = userEvent.setup();
    service.addGraphNodeBlocker.mockResolvedValue({ revision: 10, blockerIds: ["phase-1", "x"] });
    service.removeGraphNodeBlocker.mockResolvedValue({ revision: 11, blockerIds: [] });
    renderPage();
    await openGraph(user);

    await press(user, "add blocker");
    await waitFor(() =>
      expect(service.addGraphNodeBlocker).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "phase-2",
        "phase-1",
        9,
      ),
    );
    await waitFor(() => expect(graphProps().phases[1].blockerIds).toEqual(["phase-1", "x"]));

    await press(user, "remove blocker");
    await waitFor(() =>
      expect(service.removeGraphNodeBlocker).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "phase-2",
        "phase-1",
        10,
      ),
    );
    await waitFor(() => expect(graphProps().phases[1].blockerIds).toEqual([]));
  });

  it("creates a phase where the canvas was clicked", async () => {
    const user = userEvent.setup();
    service.createPhase.mockResolvedValue({
      ...richPath().blueprintPhases[0],
      id: "phase-3",
      title: "Placed",
      blueprintSteps: [],
      blueprintCheckQuestions: [],
    });
    renderPage();
    await openGraph(user);

    await press(user, "create phase");
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Title/), "Placed");
    await user.click(within(dialog).getByRole("button", { name: "Add phase" }));

    await waitFor(() =>
      expect(service.createPhase).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1", {
        position: 2,
        title: "Placed",
        description: null,
        aiPrompt: null,
        type: "FIXED",
        graphX: 5,
        graphY: 6,
      }),
    );
    await waitFor(() => expect(graphProps().phases.map((p) => p.id)).toContain("phase-3"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("deletes a phase straight from the graph and drops it", async () => {
    const user = userEvent.setup();
    service.deletePhase.mockResolvedValue({ updatedPhases: [{ id: "phase-2", revision: 12 }] });
    renderPage();
    await openGraph(user);

    await press(user, "delete phase");

    expect(await resultOf("delete phase")).toBe("ok");
    expect(service.deletePhase).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", 1);
    await waitFor(() => expect(graphProps().phases.map((p) => p.id)).toEqual(["phase-2"]));
    expect(graphProps().phases[0]).toMatchObject({ revision: 12, blockerIds: [] });
  });

  it("tells the editor a delete failed rather than letting it report success", async () => {
    const user = userEvent.setup();
    service.deletePhase.mockRejectedValue(new Error("Stale revision"));
    renderPage();
    await openGraph(user);

    await press(user, "delete phase");

    expect(await resultOf("delete phase")).toBe("Stale revision");
    expect(await screen.findByText("Stale revision", { selector: "p" })).toBeInTheDocument();
    expect(graphProps().phases).toHaveLength(2);
  });

  it("renames a phase from the graph and reloads", async () => {
    const user = userEvent.setup();
    service.updatePhase.mockResolvedValue({});
    renderPage();
    await openGraph(user);
    const loads = service.getPath.mock.calls.length;

    await press(user, "update phase");

    await waitFor(() =>
      expect(service.updatePhase).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", {
        revision: 1,
        position: 0,
        title: "Renamed",
        description: "New text",
        type: "FIXED",
        aiPrompt: null,
      }),
    );
    await waitFor(() => expect(service.getPath.mock.calls.length).toBe(loads + 1));
  });

  it("does not open a sub-graph for an AI phase", async () => {
    const user = userEvent.setup();
    renderPage();
    await openGraph(user);

    await press(user, "open AI sub-graph");

    expect(await resultOf("open AI sub-graph")).toBe("ok");
    expect(service.getSubGraph).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sub-graph-editor")).not.toBeInTheDocument();
  });

  it("reports a phase graph that could not be loaded", async () => {
    const user = userEvent.setup();
    service.getSubGraph.mockRejectedValue(new Error("Phase graph is down"));
    renderPage();
    await openGraph(user);

    await press(user, "open sub-graph");

    expect(await screen.findByText("Phase graph is down")).toBeInTheDocument();
    expect(screen.queryByTestId("sub-graph-editor")).not.toBeInTheDocument();
  });

  it("uses a generic message when the phase graph failure carries none", async () => {
    const user = userEvent.setup();
    service.getSubGraph.mockRejectedValue("nope");
    renderPage();
    await openGraph(user);

    await press(user, "open sub-graph");

    expect(await screen.findByText("Phase graph could not be loaded.")).toBeInTheDocument();
  });

  it("opens a draft from a published graph and lands back on the phase", async () => {
    const published = richPath("ACTIVE");
    const draft = { ...richPath("DRAFT"), id: "draft-1", version: 4 };
    service.getPath.mockImplementation((_scope: unknown, id: unknown) =>
      Promise.resolve(id === "draft-1" ? draft : published),
    );
    service.getGraph.mockImplementation((_scope: unknown, id: unknown) =>
      Promise.resolve({
        nodes: (id === "draft-1" ? draft : published).blueprintPhases.map((phase) => ({
          id: phase.id,
          revision: phase.revision,
          title: phase.title,
          graphX: phase.graphX,
          graphY: phase.graphY,
          blockerIds: phase.blockerIds,
        })),
      }),
    );
    service.openDraft.mockResolvedValue({ id: "draft-1", version: 4 });
    const user = userEvent.setup();
    renderPage();
    await openGraph(user);

    await press(user, "request draft");

    await waitFor(() => expect(service.openDraft).toHaveBeenCalledWith(PROJECT_SCOPE, "key-1"));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/draft-1"),
    );
    await waitFor(() => expect(graphProps().openPhaseTitle).toBe("Get set up"));
    expect(graphProps().editable).toBe(true);
  });

  it("tells the author by toast when that draft could not be opened", async () => {
    servePath(richPath("ACTIVE"));
    service.openDraft.mockRejectedValue(new Error("No draft for you"));
    const user = userEvent.setup();
    renderPage();
    await openGraph(user);

    await press(user, "request draft");

    const { toast } = await import("./support/blueprintPathMocks.ts");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The draft could not be opened", {
        description: "No draft for you",
      }),
    );
  });
});

describe("BlueprintPathDetailPage phase graph editor", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
    service.getSubGraph.mockResolvedValue({ nodes: subGraphNodes });
  });

  it("shows the phase's own graph and whether it can be edited", async () => {
    const user = userEvent.setup();
    renderPage();
    await openSubGraph(user);

    const props = subProps();
    expect(props.phase).toBe("Get set up");
    expect(props.editable).toBe(true);
    expect(props.nodes.map((node) => node.id)).toEqual(["step-1", "step-2", "q-1"]);
    expect(service.getSubGraph).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1");
  });

  it("goes back to the top-level graph with fresh positions", async () => {
    const user = userEvent.setup();
    service.getGraph.mockResolvedValue({
      nodes: [
        { id: "phase-1", revision: 4, title: "Get set up", graphX: 70, graphY: 80, blockerIds: [] },
      ],
    });
    renderPage();
    await openSubGraph(user);

    await press(user, "back");

    await screen.findByTestId("graph-editor");
    await waitFor(() =>
      expect(graphProps().phases[0]).toMatchObject({ revision: 4, x: 70, y: 80 }),
    );
    expect(screen.queryByTestId("sub-graph-editor")).not.toBeInTheDocument();
  });

  it("reports a top-level graph that could not be reloaded on the way back", async () => {
    const user = userEvent.setup();
    renderPage();
    await openSubGraph(user);
    service.getGraph.mockRejectedValue(new Error("Graph gone"));

    await press(user, "back");

    expect(await screen.findByText("Graph gone")).toBeInTheDocument();
  });

  it("saves a moved node and keeps the new place", async () => {
    const user = userEvent.setup();
    service.updateSubGraphNodePosition.mockResolvedValue({ revision: 3, graphX: 31, graphY: 41 });
    renderPage();
    await openSubGraph(user);

    await press(user, "move node");

    await waitFor(() =>
      expect(service.updateSubGraphNodePosition).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", {
        revision: 2,
        graphX: 31,
        graphY: 41,
      }),
    );
    await waitFor(() => expect(subProps().nodes[0]).toMatchObject({ revision: 3, x: 31, y: 41 }));
  });

  it("puts a node back where it was when the move is refused", async () => {
    const user = userEvent.setup();
    service.updateSubGraphNodePosition.mockRejectedValue(new Error("Moved elsewhere"));
    renderPage();
    await openSubGraph(user);

    await press(user, "move node");

    expect(await resultOf("move node")).toBe("Moved elsewhere");
    expect(subProps().nodes[0]).toMatchObject({ revision: 2, x: 1, y: 2 });
  });

  it("adds and removes a node's prerequisite", async () => {
    const user = userEvent.setup();
    service.addSubGraphNodeBlocker.mockResolvedValue({ revision: 6, blockerIds: ["step-1", "z"] });
    service.removeSubGraphNodeBlocker.mockResolvedValue({ revision: 7, blockerIds: [] });
    renderPage();
    await openSubGraph(user);

    await press(user, "add node blocker");
    await waitFor(() =>
      expect(service.addSubGraphNodeBlocker).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "step-2",
        "step-1",
        1,
      ),
    );
    await waitFor(() => expect(subProps().nodes[1].blockerIds).toEqual(["step-1", "z"]));

    await press(user, "remove node blocker");
    await waitFor(() =>
      expect(service.removeSubGraphNodeBlocker).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "step-2",
        "step-1",
        6,
      ),
    );
    await waitFor(() => expect(subProps().nodes[1].blockerIds).toEqual([]));
  });

  it("creates a step where the canvas was clicked", async () => {
    const user = userEvent.setup();
    service.createStep.mockResolvedValue({
      ...richPath().blueprintPhases[0].blueprintSteps[0],
      id: "step-3",
      title: "Placed step",
      revision: 0,
      blueprintPhaseId: "phase-1",
    });
    renderPage();
    await openSubGraph(user);

    await press(user, "create step");
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Title/), "Placed step");
    await user.type(within(dialog).getByLabelText(/^Description/), "d");
    await user.type(within(dialog).getByLabelText(/^Expected outcome/), "o");
    await user.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() =>
      expect(service.createStep).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "phase-1",
        expect.objectContaining({ position: 2, title: "Placed step", graphX: 7, graphY: 8 }),
      ),
    );
    await waitFor(() => expect(subProps().steps).toContain("Placed step"));
    expect(subProps().nodes.map((node) => node.id)).toContain("step-3");
    expect(subProps().nodes.find((node) => node.id === "step-3")).toMatchObject({ x: 7, y: 8 });
  });

  it("creates a question where the canvas was clicked", async () => {
    const user = userEvent.setup();
    service.createQuestion.mockResolvedValue({
      ...richPath().blueprintPhases[0].blueprintCheckQuestions[0],
      id: "q-3",
      title: "Placed question",
      revision: 0,
      blueprintPhaseId: "phase-1",
    });
    renderPage();
    await openSubGraph(user);

    await press(user, "create question");
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Node title/), "Placed question");
    await user.type(within(dialog).getByLabelText(/^Question\*?$/), "Why?");
    await user.click(within(dialog).getByRole("button", { name: "Add question" }));

    await waitFor(() =>
      expect(service.createQuestion).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "phase-1",
        expect.objectContaining({ position: 2, title: "Placed question", graphX: 9, graphY: 10 }),
      ),
    );
    await waitFor(() => expect(subProps().questions).toContain("Placed question"));
    expect(subProps().nodes.find((node) => node.id === "q-3")).toMatchObject({ x: 9, y: 10 });
  });

  it("updates a question from the editor and refreshes the phase", async () => {
    const user = userEvent.setup();
    service.updateQuestion.mockResolvedValue({});
    renderPage();
    await openSubGraph(user);
    const loads = service.getSubGraph.mock.calls.length;

    await press(user, "update question");

    await waitFor(() =>
      expect(service.updateQuestion).toHaveBeenCalledWith(PROJECT_SCOPE, "q-1", {
        revision: 5,
        position: 0,
        title: "Retitled",
        type: "SHORT_TEXT",
        question: "New wording",
        explanation: null,
        correctAnswer: "main",
      }),
    );
    await waitFor(() => expect(service.getSubGraph.mock.calls.length).toBe(loads + 1));
  });

  it("adds an option to the end of a question", async () => {
    const user = userEvent.setup();
    service.createOption.mockResolvedValue({});
    renderPage();
    await openSubGraph(user);

    await press(user, "add option");

    await waitFor(() =>
      expect(service.createOption).toHaveBeenCalledWith(PROJECT_SCOPE, "q-1", {
        position: 2,
        label: "Maybe",
        correct: true,
      }),
    );
  });

  it("asks before removing an option", async () => {
    const user = userEvent.setup();
    renderPage();
    await openSubGraph(user);

    await press(user, "remove option");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete option "A VCS"?')).toBeInTheDocument();
  });

  it("updates a step from the editor and refreshes the phase", async () => {
    const user = userEvent.setup();
    service.updateStep.mockResolvedValue({});
    renderPage();
    await openSubGraph(user);

    await press(user, "update step");

    await waitFor(() =>
      expect(service.updateStep).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", {
        revision: 2,
        position: 0,
        title: "Retitled step",
        description: "New",
        type: "VIDEO",
        aiAssisted: true,
        estimatedMinutes: 5,
        expectedOutcome: "Done",
      }),
    );
  });

  it("opens the add forms for a step's tasks and resources", async () => {
    const user = userEvent.setup();
    service.createTask.mockResolvedValue({});
    service.createResource.mockResolvedValue({});
    renderPage();
    await openSubGraph(user);

    await press(user, "add task");
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Title/), "T");
    await user.type(within(dialog).getByLabelText(/^Description/), "D");
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(service.createTask).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", {
        position: 2,
        title: "T",
        description: "D",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await press(user, "add resource");
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Add resource", { selector: "h2" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  });

  it("asks before removing a task or a resource", async () => {
    const user = userEvent.setup();
    renderPage();
    await openSubGraph(user);

    await press(user, "remove task");
    let dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete task "Run git clone"?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await press(user, "remove resource");
    dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete resource "Git handbook"?')).toBeInTheDocument();
  });

  it("opens the edit forms for a task, a resource and an option", async () => {
    const user = userEvent.setup();
    renderPage();
    await openSubGraph(user);

    await press(user, "edit task");
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue("Run git clone");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await press(user, "edit resource");
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^URL/)).toHaveValue("https://example.com/git");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await press(user, "edit option");
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^Label/)).toHaveValue("A VCS");
  });

  it("deletes a step from the editor and drops its node", async () => {
    const user = userEvent.setup();
    service.deleteStep.mockResolvedValue({ updatedSteps: [{ id: "step-2", revision: 9 }] });
    renderPage();
    await openSubGraph(user);

    await press(user, "delete step");

    expect(await resultOf("delete step")).toBe("ok");
    expect(service.deleteStep).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", 2);
    await waitFor(() => expect(subProps().nodes.map((node) => node.id)).toEqual(["step-2", "q-1"]));
    expect(subProps().nodes[0]).toMatchObject({ revision: 9, blockerIds: [] });
    expect(subProps().steps).toEqual(["Build it"]);
  });

  it("deletes a question from the editor and drops its node", async () => {
    const user = userEvent.setup();
    service.deleteQuestion.mockResolvedValue({ updatedQuestions: [{ id: "q-2", revision: 14 }] });
    renderPage();
    await openSubGraph(user);

    await press(user, "delete question");

    expect(await resultOf("delete question")).toBe("ok");
    expect(service.deleteQuestion).toHaveBeenCalledWith(PROJECT_SCOPE, "q-1", 5);
    await waitFor(() =>
      expect(subProps().nodes.map((node) => node.id)).toEqual(["step-1", "step-2"]),
    );
    expect(subProps().questions).toEqual(["Free node"]);
  });

  it("refreshes the phase graph after a form saved while it is open", async () => {
    const user = userEvent.setup();
    service.updateTask.mockResolvedValue({});
    renderPage();
    await openSubGraph(user);
    const loads = service.getSubGraph.mock.calls.length;

    await press(user, "edit task");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(service.getSubGraph.mock.calls.length).toBe(loads + 1));
  });

  it("asks for a draft from a node, and reopens that node on the draft", async () => {
    const published = richPath("ACTIVE");
    const draft = { ...richPath("DRAFT"), id: "draft-1", version: 4 };
    service.getPath.mockImplementation((_scope: unknown, id: unknown) =>
      Promise.resolve(id === "draft-1" ? draft : published),
    );
    service.getGraph.mockImplementation(() => Promise.resolve({ nodes: [] }));
    service.openDraft.mockResolvedValue({ id: "draft-1", version: 4 });
    const user = userEvent.setup();
    renderPage();
    await openSubGraph(user);

    await press(user, "request draft");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/blueprints/draft-1"),
    );
    await waitFor(() => expect(screen.getByTestId("sub-graph-editor")).toBeInTheDocument());
    await waitFor(() => expect(subProps().openNodeTitle).toBe("Clone the repo"));
    expect(subProps().editable).toBe(true);
    await press(user, "opened node");
    await waitFor(() => expect(subProps().openNodeTitle).toBeNull());
  });
});
