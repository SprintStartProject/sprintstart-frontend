import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { blueprintService, type BlueprintScope } from "../../../src/services/blueprintService";
import { mockKeycloakInstance, server } from "../../unit/setup/vitest.setup";

type Recorded = { method: string; path: string; body: unknown };

const project: BlueprintScope = { kind: "project", projectId: "p 1" };
const global: BlueprintScope = { kind: "global" };
const projectBase = "/api/v1/projects/p%201/onboarding";

const backendPhase = {
  id: "phase-1",
  title: "Arrive",
  blueprintPhaseRequirements: [{ id: "req-1", referenceId: "skill-1", type: "SKILL" }],
};
const backendPath = { id: "path-1", title: "Path", blueprintPhases: [backendPhase] };

let requests: Recorded[] = [];

function respondWith(body: JsonBodyType): void {
  server.use(
    http.all("*", async ({ request }) => {
      const text = request.method === "GET" ? "" : await request.text();
      requests.push({
        method: request.method,
        path: decodeURI(new URL(request.url).pathname).replace(/ /g, "%20"),
        body: text ? JSON.parse(text) : undefined,
      });
      return HttpResponse.json(body);
    }),
  );
}

beforeEach(() => {
  requests = [];
  mockKeycloakInstance.authenticated = true;
  mockKeycloakInstance.token = "test-token";
  mockKeycloakInstance.updateToken.mockResolvedValue(true);
});

describe("blueprintService scopes", () => {
  it("reads project blueprints under the project and global ones under onboarding", async () => {
    respondWith([]);

    await blueprintService.getPaths(project);
    await blueprintService.getPaths(global);

    expect(requests.map((r) => r.path)).toEqual([
      `${projectBase}/blueprints`,
      "/api/v1/onboarding/blueprints",
    ]);
  });

  it("puts phase graph nodes beside the blueprints, not inside them", async () => {
    respondWith({ revision: 2, graphX: 1, graphY: 2 });

    await blueprintService.updateGraphNodePosition(global, "node-1", {
      revision: 1,
      graphX: 1,
      graphY: 2,
    });

    expect(requests[0]).toEqual({
      method: "PUT",
      path: "/api/v1/onboarding/blueprint/graph-nodes/node-1/position",
      body: { revision: 1, graphX: 1, graphY: 2 },
    });
  });
});

describe("blueprintService mapping", () => {
  it("names a phase's requirements the way the authoring UI reads them and fills graph defaults", async () => {
    respondWith(backendPath);

    const path = await blueprintService.getPath(project, "path-1");

    expect(path.blueprintPhases[0]).toMatchObject({
      requirements: backendPhase.blueprintPhaseRequirements,
      blockerIds: [],
      graphX: null,
      graphY: null,
    });
  });

  it("keeps the graph position and blockers a phase already has", async () => {
    respondWith({ ...backendPhase, blockerIds: ["phase-0"], graphX: 10, graphY: 20 });

    const phase = await blueprintService.getPhase(project, "phase-1");

    expect(phase).toMatchObject({ blockerIds: ["phase-0"], graphX: 10, graphY: 20 });
  });

  it("maps every version of a blueprint's history", async () => {
    respondWith([backendPath, { ...backendPath, id: "path-2", blueprintPhases: [] }]);

    const history = await blueprintService.getHistory(project, "key-1");

    expect(history.map((p) => p.id)).toEqual(["path-1", "path-2"]);
    expect(history[0].blueprintPhases[0].requirements).toHaveLength(1);
  });

  it("loads skills and project roles together as the requirement catalog", async () => {
    server.use(
      http.get("/api/v1/skills", () => HttpResponse.json([{ id: "s", name: "Kotlin" }])),
      http.get("/api/v1/projectRoles", () => HttpResponse.json([{ id: "r", name: "Backend" }])),
    );

    const catalog = await blueprintService.getRequirementCatalog();

    expect(catalog).toEqual({
      skills: [{ id: "s", name: "Kotlin" }],
      projectRoles: [{ id: "r", name: "Backend" }],
    });
  });
});

const b = `${projectBase}/blueprints`;
const g = `${projectBase}/blueprint/graph-nodes`;
const position = { revision: 3, position: 1 };
const graphPosition = { revision: 3, graphX: 4, graphY: 5 };
const phaseInput = {
  position: 0,
  title: "T",
  description: null,
  aiPrompt: null,
  type: "FIXED" as const,
};
const stepInput = {
  position: 0,
  title: "S",
  description: null,
  type: "DOCUMENT" as const,
  estimatedMinutes: 5,
  expectedOutcome: "done",
};
const questionInput = {
  position: 0,
  title: "Q",
  type: "MULTIPLE_CHOICE" as const,
  question: "?",
  explanation: null,
  correctAnswer: null,
};

const endpoints: [string, () => Promise<unknown>, Recorded][] = [
  [
    "getGraph",
    () => blueprintService.getGraph(project, "path-1"),
    { method: "GET", path: `${b}/paths/path-1/graph`, body: undefined },
  ],
  [
    "getSubGraph",
    () => blueprintService.getSubGraph(project, "ph"),
    { method: "GET", path: `${b}/phase/ph/graph`, body: undefined },
  ],
  [
    "getStep",
    () => blueprintService.getStep(project, "st"),
    { method: "GET", path: `${b}/steps/st`, body: undefined },
  ],
  [
    "getQuestion",
    () => blueprintService.getQuestion(project, "q"),
    { method: "GET", path: `${b}/checks/questions/q`, body: undefined },
  ],
  [
    "createPath",
    () => blueprintService.createPath(project, { title: "P", description: "D" }),
    { method: "POST", path: `${b}/paths`, body: { title: "P", description: "D" } },
  ],
  [
    "openDraft",
    () => blueprintService.openDraft(project, "key"),
    { method: "POST", path: `${b}/key/draft`, body: undefined },
  ],
  [
    "publishPath",
    () => blueprintService.publishPath(project, "path-1"),
    { method: "POST", path: `${b}/paths/path-1/publish`, body: undefined },
  ],
  [
    "archivePath",
    () => blueprintService.archivePath(project, "key"),
    { method: "POST", path: `${b}/key/archive`, body: undefined },
  ],
  [
    "deleteDraft",
    () => blueprintService.deleteDraft(project, "path-1"),
    { method: "DELETE", path: `${b}/paths/path-1`, body: undefined },
  ],
  [
    "rollbackPath",
    () => blueprintService.rollbackPath(project, "key", 2),
    { method: "POST", path: `${b}/key/rollBack/2`, body: undefined },
  ],
  [
    "createPhase",
    () => blueprintService.createPhase(project, "path-1", phaseInput),
    { method: "POST", path: `${b}/path/path-1/phases`, body: phaseInput },
  ],
  [
    "updatePhase",
    () => blueprintService.updatePhase(project, "ph", { ...phaseInput, revision: 3 }),
    { method: "PUT", path: `${b}/phases/ph`, body: { ...phaseInput, revision: 3 } },
  ],
  [
    "updatePhasePosition",
    () => blueprintService.updatePhasePosition(project, "ph", position),
    { method: "PUT", path: `${b}/phases/ph/position`, body: position },
  ],
  [
    "deletePhase",
    () => blueprintService.deletePhase(project, "ph", 3),
    { method: "DELETE", path: `${b}/phases/ph`, body: { revision: 3 } },
  ],
  [
    "addPhaseRequirements",
    () =>
      blueprintService.addPhaseRequirements(project, "ph", 3, [
        { referenceId: "s", type: "SKILL" },
      ]),
    {
      method: "POST",
      path: `${b}/phases/ph/requirements`,
      body: { revision: 3, requirements: [{ referenceId: "s", type: "SKILL" }] },
    },
  ],
  [
    "deletePhaseRequirements",
    () => blueprintService.deletePhaseRequirements(project, "ph", 3, ["r"]),
    {
      method: "DELETE",
      path: `${b}/phases/ph/requirements`,
      body: { revision: 3, requirementIds: ["r"] },
    },
  ],
  [
    "createStep",
    () => blueprintService.createStep(project, "ph", stepInput),
    { method: "POST", path: `${b}/phases/ph/steps`, body: stepInput },
  ],
  [
    "updateStep",
    () =>
      blueprintService.updateStep(project, "st", { ...stepInput, revision: 3, aiAssisted: true }),
    { method: "PUT", path: `${b}/steps/st`, body: { ...stepInput, revision: 3, aiAssisted: true } },
  ],
  [
    "deleteStep",
    () => blueprintService.deleteStep(project, "st", 3),
    { method: "DELETE", path: `${b}/steps/st`, body: { revision: 3 } },
  ],
  [
    "updateStepPosition",
    () => blueprintService.updateStepPosition(project, "st", position),
    { method: "PUT", path: `${b}/steps/st/position`, body: position },
  ],
  [
    "removeGraphNodePosition",
    () => blueprintService.removeGraphNodePosition(project, "n", 3),
    { method: "DELETE", path: `${g}/n/position`, body: { revision: 3 } },
  ],
  [
    "addGraphNodeBlocker",
    () => blueprintService.addGraphNodeBlocker(project, "n", "m", 3),
    { method: "POST", path: `${g}/n/blockers/m`, body: { revision: 3 } },
  ],
  [
    "removeGraphNodeBlocker",
    () => blueprintService.removeGraphNodeBlocker(project, "n", "m", 3),
    { method: "DELETE", path: `${g}/n/blockers/m`, body: { revision: 3 } },
  ],
  [
    "updateSubGraphNodePosition",
    () => blueprintService.updateSubGraphNodePosition(project, "n", graphPosition),
    { method: "PUT", path: `${b}/sub-graph-nodes/n/position`, body: graphPosition },
  ],
  [
    "removeSubGraphNodePosition",
    () => blueprintService.removeSubGraphNodePosition(project, "n", 3),
    { method: "DELETE", path: `${b}/sub-graph-nodes/n/position`, body: { revision: 3 } },
  ],
  [
    "addSubGraphNodeBlocker",
    () => blueprintService.addSubGraphNodeBlocker(project, "n", "m", 3),
    { method: "POST", path: `${b}/sub-graph-nodes/n/blockers/m`, body: { revision: 3 } },
  ],
  [
    "removeSubGraphNodeBlocker",
    () => blueprintService.removeSubGraphNodeBlocker(project, "n", "m", 3),
    { method: "DELETE", path: `${b}/sub-graph-nodes/n/blockers/m`, body: { revision: 3 } },
  ],
  [
    "createTask",
    () =>
      blueprintService.createTask(project, "st", { position: 0, title: "T", description: null }),
    {
      method: "POST",
      path: `${b}/steps/st/task`,
      body: { position: 0, title: "T", description: null },
    },
  ],
  [
    "deleteTask",
    () => blueprintService.deleteTask(project, "t", 3),
    { method: "DELETE", path: `${b}/tasks/t`, body: { revision: 3 } },
  ],
  [
    "updateTask",
    () =>
      blueprintService.updateTask(project, "t", {
        position: 0,
        title: "T",
        description: null,
        revision: 3,
      }),
    {
      method: "PUT",
      path: `${b}/tasks/t`,
      body: { position: 0, title: "T", description: null, revision: 3 },
    },
  ],
  [
    "updateTaskPosition",
    () => blueprintService.updateTaskPosition(project, "t", position),
    { method: "PUT", path: `${b}/tasks/t/position`, body: position },
  ],
  [
    "createResource",
    () =>
      blueprintService.createResource(project, "st", { title: "R", description: "D", url: "u" }),
    {
      method: "POST",
      path: `${b}/step/st/resources`,
      body: { title: "R", description: "D", url: "u" },
    },
  ],
  [
    "deleteResource",
    () => blueprintService.deleteResource(project, "r", 3),
    { method: "DELETE", path: `${b}/resources/r`, body: { revision: 3 } },
  ],
  [
    "updateResource",
    () =>
      blueprintService.updateResource(project, "r", {
        title: "R",
        description: "D",
        url: "u",
        revision: 3,
      }),
    {
      method: "PUT",
      path: `${b}/resources/r`,
      body: { title: "R", description: "D", url: "u", revision: 3 },
    },
  ],
  [
    "createQuestion",
    () => blueprintService.createQuestion(project, "ph", questionInput),
    { method: "POST", path: `${b}/phase/ph/checks/questions`, body: questionInput },
  ],
  [
    "updateQuestion",
    () => blueprintService.updateQuestion(project, "q", { ...questionInput, revision: 3 }),
    { method: "PUT", path: `${b}/checks/question/q`, body: { ...questionInput, revision: 3 } },
  ],
  [
    "deleteQuestion",
    () => blueprintService.deleteQuestion(project, "q", 3),
    { method: "DELETE", path: `${b}/checks/question/q`, body: { revision: 3 } },
  ],
  [
    "updateQuestionPosition",
    () => blueprintService.updateQuestionPosition(project, "q", position),
    { method: "PUT", path: `${b}/checks/question/q/position`, body: position },
  ],
  [
    "createOption",
    () => blueprintService.createOption(project, "q", { position: 0, label: "L", correct: true }),
    {
      method: "POST",
      path: `${b}/checks/questions/q/options`,
      body: { position: 0, label: "L", correct: true },
    },
  ],
  [
    "deleteOption",
    () => blueprintService.deleteOption(project, "o", 3),
    { method: "DELETE", path: `${b}/checks/options/o`, body: { revision: 3 } },
  ],
  [
    "updateOption",
    () =>
      blueprintService.updateOption(project, "o", {
        position: 0,
        label: "L",
        correct: false,
        revision: 3,
      }),
    {
      method: "PUT",
      path: `${b}/checks/options/o`,
      body: { position: 0, label: "L", correct: false, revision: 3 },
    },
  ],
  [
    "updateOptionPosition",
    () => blueprintService.updateOptionPosition(project, "o", position),
    { method: "PUT", path: `${b}/checks/options/o/position`, body: position },
  ],
];

describe("blueprintService endpoints", () => {
  it.each(endpoints)("%s sends the request the backend expects", async (_name, call, expected) => {
    respondWith({ ...backendPath, ...backendPhase, id: "x" });

    await call();

    expect(requests).toEqual([expected]);
  });
});
