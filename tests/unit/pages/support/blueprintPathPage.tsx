import { render } from "@testing-library/react";
import { service } from "./blueprintPathMocks.ts";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocationProbe } from "./LocationProbe.tsx";
import { BlueprintPathDetailPage } from "../../../../src/pages/BlueprintPathDetailPage.tsx";
import type { BlueprintPath } from "../../../../src/features/blueprints/types.ts";

export const PROJECT_SCOPE = { kind: "project", projectId: "project-1" };

type Overrides = Partial<BlueprintPath> & Record<string, unknown>;

/** A path with one phase that has one step (a task and a resource) and one question. */
export function pathFixture(status: BlueprintPath["status"] = "DRAFT", overrides: Overrides = {}) {
  return {
    id: "path-1",
    blueprintKey: "key-1",
    projectId: "project-1",
    version: 3,
    revision: 0,
    status,
    title: "Backend onboarding",
    description: "For new backend hires",
    blueprintPhases: [
      {
        id: "phase-1",
        blueprintPathId: "path-1",
        revision: 1,
        position: 0,
        title: "Get set up",
        description: "Tooling and access",
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
    ...overrides,
  } as unknown as BlueprintPath;
}

export function graphFixture(path: BlueprintPath) {
  return {
    nodes: path.blueprintPhases.map((phase) => ({
      id: phase.id,
      revision: phase.revision,
      title: phase.title,
      graphX: phase.graphX,
      graphY: phase.graphY,
      blockerIds: phase.blockerIds,
    })),
  };
}

/** Serves `path` (and its graph) for its own id, ready for the page to load. */
export function servePath(path: BlueprintPath) {
  service.getPath.mockImplementation((_scope: unknown, id: unknown) =>
    Promise.resolve(id === path.id ? path : { ...path, id }),
  );
  service.getGraph.mockResolvedValue(graphFixture(path));
}

/** Renders the page at `entry`, with the list page and the current URL observable. */
export function renderPage(entry = "/blueprints/path-1") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/blueprints" element={<p>Blueprint list</p>} />
        <Route path="/blueprints/:pathId" element={<BlueprintPathDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * A draft with every kind of content: a fixed phase holding two steps (the first with a task and a
 * resource), two questions (a multiple-choice one with two options, and a short-text one), and a
 * second, AI-enhanced phase.
 */
export function richPath(status: BlueprintPath["status"] = "DRAFT") {
  const base = pathFixture(status);
  const phase = {
    ...base.blueprintPhases[0],
    requirements: [
      {
        id: "req-1",
        blueprintPhaseId: "phase-1",
        referenceId: "skill-1",
        type: "SKILL",
        displayName: "Kotlin",
      },
      {
        id: "req-2",
        blueprintPhaseId: "phase-1",
        referenceId: "role-1",
        type: "PROJECT_ROLE",
        displayName: "Reviewer",
      },
    ],
    blueprintSteps: [
      {
        id: "step-1",
        blueprintPhaseId: "phase-1",
        revision: 2,
        position: 0,
        title: "Clone the repo",
        description: "Get the code",
        type: "DOCUMENT",
        estimatedMinutes: 15,
        expectedOutcome: "Repo on disk",
        aiAssisted: false,
        graphX: null,
        graphY: null,
        blockerIds: [],
        blueprintTasks: [
          {
            id: "task-1",
            blueprintStepId: "step-1",
            revision: 3,
            position: 0,
            title: "Run git clone",
            description: "Use SSH",
          },
          {
            id: "task-2",
            blueprintStepId: "step-1",
            revision: 13,
            position: 1,
            title: "Run git fetch",
            description: "Update",
          },
        ],
        blueprintResources: [
          {
            id: "res-1",
            blueprintStepId: "step-1",
            revision: 4,
            title: "Git handbook",
            description: "Read it",
            url: "https://example.com/git",
          },
        ],
      },
      {
        id: "step-2",
        blueprintPhaseId: "phase-1",
        revision: 1,
        position: 1,
        title: "Build it",
        description: "Compile",
        type: "VIDEO",
        estimatedMinutes: 30,
        expectedOutcome: "Green build",
        aiAssisted: false,
        graphX: null,
        graphY: null,
        blockerIds: [],
        blueprintTasks: [],
        blueprintResources: [],
      },
    ],
    blueprintCheckQuestions: [
      {
        id: "q-1",
        blueprintPhaseId: "phase-1",
        revision: 5,
        position: 0,
        title: "Q node",
        type: "MULTIPLE_CHOICE",
        question: "What is git?",
        explanation: "A VCS",
        correctAnswer: null,
        graphX: null,
        graphY: null,
        blockerIds: [],
        blueprintCheckOptions: [
          {
            id: "opt-1",
            blueprintCheckQuestionId: "q-1",
            revision: 6,
            position: 0,
            label: "A VCS",
            correct: true,
          },
          {
            id: "opt-2",
            blueprintCheckQuestionId: "q-1",
            revision: 7,
            position: 1,
            label: "A fruit",
            correct: false,
          },
        ],
      },
      {
        id: "q-2",
        blueprintPhaseId: "phase-1",
        revision: 8,
        position: 1,
        title: "Free node",
        type: "SHORT_TEXT",
        question: "Name the default branch",
        explanation: null,
        correctAnswer: "main",
        graphX: null,
        graphY: null,
        blockerIds: [],
        blueprintCheckOptions: [],
      },
    ],
  };
  const aiPhase = {
    ...base.blueprintPhases[0],
    id: "phase-2",
    position: 1,
    revision: 9,
    title: "Learn the domain",
    description: "",
    type: "AI_ENHANCED",
    aiPrompt: "Tailor it to the hire's role",
    graphX: 200,
    graphY: 0,
    blockerIds: ["phase-1"],
  };
  return { ...base, blueprintPhases: [phase, aiPhase] } as unknown as BlueprintPath;
}
