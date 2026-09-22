import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BlueprintPathsPage } from "../../../src/pages/BlueprintPathsPage.tsx";
import type {
  BlueprintPath,
  BlueprintPathOverview,
} from "../../../src/features/blueprints/types.ts";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    permissionGroup: "PM",
    getPaths: vi.fn(),
    getPath: vi.fn(),
    getGraph: vi.fn(),
  },
}));

vi.mock("../../../src/context/useAuth.ts", () => ({
  useAuth: () => ({ profile: { permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../src/features/projects/useProjectContext.ts", () => ({
  useProjectContext: () => ({ selectedProjectId: "project-1", isLoading: false }),
}));

vi.mock("../../../src/services/blueprintService.ts", () => ({
  blueprintService: {
    getPaths: mocks.getPaths,
    getPath: mocks.getPath,
    // The shape comes from the graph: the path DTO carries no coordinates or prerequisites.
    getGraph: mocks.getGraph,
  },
}));

function overview(over: Partial<BlueprintPathOverview> = {}): BlueprintPathOverview {
  return {
    id: "path-1",
    blueprintKey: "key-1",
    version: 2,
    revision: 0,
    title: "Backend onboarding",
    description: "How a backend hire gets started.",
    status: "ACTIVE",
    ...over,
  };
}

/** A path whose nested content is only ever read for its counts. */
function pathWith(
  phases: { type?: "FIXED" | "AI_ENHANCED"; steps?: number; questions?: number; gated?: boolean }[],
): BlueprintPath {
  return {
    ...overview(),
    blueprintPhases: phases.map((phase, index) => ({
      id: `phase-${index}`,
      blueprintPathId: "path-1",
      revision: 0,
      position: index,
      title: `Phase ${index}`,
      description: null,
      aiPrompt: null,
      type: phase.type ?? "FIXED",
      blockerIds: [],
      graphX: null,
      graphY: null,
      requirements: phase.gated
        ? [
            {
              id: `req-${index}`,
              blueprintPhaseId: `phase-${index}`,
              referenceId: "skill-1",
              type: "SKILL" as const,
              displayName: "Docker",
            },
          ]
        : [],
      blueprintSteps: Array.from({ length: phase.steps ?? 0 }, (_, stepIndex) => ({
        id: `step-${index}-${stepIndex}`,
        blueprintPhaseId: `phase-${index}`,
        revision: 0,
        position: stepIndex,
        title: "Step",
        description: "",
        type: "DOCUMENT" as const,
        aiAssisted: false,
        estimatedMinutes: 10,
        expectedOutcome: "",
        blockerIds: [],
        graphX: null,
        graphY: null,
        blueprintTasks: [],
        blueprintResources: [],
      })),
      blueprintCheckQuestions: Array.from({ length: phase.questions ?? 0 }, (_, qIndex) => ({
        id: `question-${index}-${qIndex}`,
        blueprintPhaseId: `phase-${index}`,
        revision: 0,
        title: "Q",
        position: qIndex,
        type: "SHORT_TEXT" as const,
        question: "Q?",
        explanation: null,
        correctAnswer: null,
        blueprintCheckOptions: [],
      })),
    })),
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/blueprints"]}>
      <BlueprintPathsPage />
    </MemoryRouter>,
  );
}

describe("BlueprintPathsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissionGroup = "PM";
    mocks.getPath.mockResolvedValue(pathWith([]));
    mocks.getGraph.mockResolvedValue({ nodes: [] });
  });

  it("groups by what hires get, not by the status of the newest version", async () => {
    mocks.getPaths.mockResolvedValue([
      overview({ id: "a", title: "Retired one", status: "ARCHIVED", version: 1 }),
      overview({ id: "b", title: "Never published", status: "DRAFT", version: 0 }),
      overview({ id: "c", title: "Live one", status: "ACTIVE", version: 2 }),
    ]);

    renderPage();

    const headings = (await screen.findAllByRole("heading", { level: 2 })).map(
      (heading) => heading.textContent,
    );
    expect(headings[0]).toContain("In service");
    expect(headings[1]).toContain("Not in service yet");
    expect(headings[2]).toContain("Retired");
  });

  it("keeps a blueprint in service while a draft of it is being written", async () => {
    // The whole reason this page was restructured: the newest version of this blueprint is a
    // draft, and every hire on the project is still being given version 3.
    mocks.getPaths.mockResolvedValue([overview({ status: "DRAFT", version: 4 })]);

    renderPage();

    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("In service");
    expect(screen.getByText("v3 in service")).toBeInTheDocument();
    expect(screen.getByText("v4 being written")).toBeInTheDocument();
  });

  it("leaves a group out entirely when nothing is in it", async () => {
    mocks.getPaths.mockResolvedValue([overview({ status: "ACTIVE" })]);

    renderPage();

    const headings = (await screen.findAllByRole("heading", { level: 2 })).map(
      (heading) => heading.textContent,
    );

    expect(headings).toHaveLength(1);
    expect(headings[0]).toContain("In service");
  });

  it("says plainly when nobody has ever been given a blueprint", async () => {
    mocks.getPaths.mockResolvedValue([overview({ status: "DRAFT", version: 0 })]);

    renderPage();

    expect(await screen.findByText("Nobody has this yet")).toBeInTheDocument();
    // The rail says what is live, and for this blueprint nothing is — so it says nothing at all
    // rather than naming a version that reaches no one.
    expect(screen.queryByText(/v\d+ in service/)).not.toBeInTheDocument();
  });

  it("says what shape a blueprint is, not only how much of it there is", async () => {
    mocks.getPaths.mockResolvedValue([overview()]);
    mocks.getPath.mockResolvedValue(pathWith([{}, {}, {}]));

    renderPage();

    // Three phases with nothing sequencing them is a very different thing to be handed than three
    // in a row, and no count on the card can tell them apart.
    expect(await screen.findByText("No order between any of them")).toBeInTheDocument();
  });

  /**
   * The order between phases is only on the graph endpoint -- `GET /paths/{id}` carries no
   * `blockerIds`, and the client fills them in as `[]`. Reading the path alone therefore described
   * every blueprint, however carefully sequenced, as having no order at all.
   */
  it("reads the shape from the graph, not from the path that does not carry it", async () => {
    mocks.getPaths.mockResolvedValue([overview()]);
    mocks.getPath.mockResolvedValue(pathWith([{}, {}, {}]));
    mocks.getGraph.mockResolvedValue({
      nodes: [
        { id: "phase-0", revision: 0, title: "One", graphX: 0, graphY: 0, blockerIds: [] },
        { id: "phase-1", revision: 0, title: "Two", graphX: 0, graphY: 1, blockerIds: ["phase-0"] },
        {
          id: "phase-2",
          revision: 0,
          title: "Three",
          graphX: 0,
          graphY: 2,
          blockerIds: ["phase-1"],
        },
      ],
    });

    renderPage();

    await screen.findByRole("heading", { name: "Backend onboarding" });
    expect(screen.queryByText("No order between any of them")).not.toBeInTheDocument();
  });

  it("narrows the page to what somebody is looking for", async () => {
    mocks.getPaths.mockResolvedValue([
      overview({ id: "a", title: "Backend onboarding" }),
      overview({ id: "b", title: "Design onboarding" }),
    ]);

    renderPage();
    await screen.findByRole("heading", { name: "Backend onboarding" });

    fireEvent.change(screen.getByRole("textbox", { name: "Find a blueprint" }), {
      target: { value: "design" },
    });

    expect(screen.queryByRole("heading", { name: "Backend onboarding" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Design onboarding" })).toBeInTheDocument();
  });

  it("counts what is in a blueprint once it has been read", async () => {
    mocks.getPaths.mockResolvedValue([overview()]);
    mocks.getPath.mockResolvedValue(
      pathWith([
        { steps: 2, questions: 1 },
        { steps: 1, questions: 0, gated: true },
      ]),
    );

    renderPage();

    const card = (await screen.findByRole("heading", { name: "Backend onboarding" })).closest(
      "article",
    ) as HTMLElement;
    const stats = within(card).getAllByRole("definition")[0].closest("dl")?.textContent;

    expect(stats).toContain("2 phases");
    expect(stats).toContain("3 steps");
    expect(stats).toContain("1 knowledge checks");
    expect(stats).toContain("1 gated phase");
  });

  it("warns when a blueprint has no content of its own to fall back on", async () => {
    mocks.getPaths.mockResolvedValue([overview()]);
    mocks.getPath.mockResolvedValue(pathWith([{ type: "AI_ENHANCED" }, { type: "AI_ENHANCED" }]));

    renderPage();

    expect(await screen.findByText(/Every phase is AI-enhanced/)).toBeInTheDocument();
  });

  it("says nothing about content it has not read, rather than claiming zero", async () => {
    mocks.getPaths.mockResolvedValue([overview()]);
    mocks.getPath.mockRejectedValue(new Error("nope"));

    renderPage();

    // The card is still useful; the counts are simply absent.
    expect(await screen.findByRole("heading", { name: "Backend onboarding" })).toBeInTheDocument();
    expect(screen.queryByText("phases")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the scope switch only to an admin", async () => {
    mocks.getPaths.mockResolvedValue([]);

    const { unmount } = renderPage();
    expect(await screen.findByText("No blueprint paths yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Global blueprints" })).not.toBeInTheDocument();
    unmount();

    mocks.permissionGroup = "ADMIN";
    renderPage();
    expect(await screen.findByRole("button", { name: "Global blueprints" })).toBeInTheDocument();
  });
});
