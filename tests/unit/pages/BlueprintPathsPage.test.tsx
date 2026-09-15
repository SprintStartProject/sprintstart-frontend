import { render, screen, within } from "@testing-library/react";
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
  },
}));

vi.mock("../../../src/context/useAuth.ts", () => ({
  useAuth: () => ({ profile: { permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../src/features/projects/useProjectContext.ts", () => ({
  useProjectContext: () => ({ selectedProjectId: "project-1", isLoading: false }),
}));

vi.mock("../../../src/services/blueprintService.ts", () => ({
  blueprintService: { getPaths: mocks.getPaths, getPath: mocks.getPath },
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
  });

  it("groups by status, drafts first, so what needs finishing is read first", async () => {
    mocks.getPaths.mockResolvedValue([
      overview({ id: "a", title: "Archived one", status: "ARCHIVED", version: 1 }),
      overview({ id: "b", title: "Live one", status: "ACTIVE", version: 2 }),
      overview({ id: "c", title: "Draft one", status: "DRAFT", version: 3 }),
    ]);

    renderPage();

    const headings = (await screen.findAllByRole("heading", { level: 2 })).map(
      (heading) => heading.textContent,
    );
    expect(headings[0]).toContain("Drafts");
    expect(headings[1]).toContain("Published");
    expect(headings[2]).toContain("Archived");
  });

  it("leaves a group out entirely when nothing is in it", async () => {
    mocks.getPaths.mockResolvedValue([overview({ status: "ACTIVE" })]);

    renderPage();

    const headings = (await screen.findAllByRole("heading", { level: 2 })).map(
      (heading) => heading.textContent,
    );

    expect(headings).toHaveLength(1);
    expect(headings[0]).toContain("Published");
  });

  it("names the version that stays in service while a draft is written", async () => {
    mocks.getPaths.mockResolvedValue([overview({ status: "DRAFT", version: 4 })]);

    renderPage();

    expect(
      await screen.findByText("Version 3 stays published until you publish this one."),
    ).toBeInTheDocument();
  });

  it("says a draft that was never published has reached nobody", async () => {
    mocks.getPaths.mockResolvedValue([overview({ status: "DRAFT", version: 0 })]);

    renderPage();

    expect(
      await screen.findByText("Never published — no hire has been given this yet."),
    ).toBeInTheDocument();
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
