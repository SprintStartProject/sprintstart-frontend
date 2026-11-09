import { beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_VALUES, valuesForEdit } from "../../../../src/features/blueprints/itemFormValues.ts";
import { createItem, updateItem } from "../../../../src/features/blueprints/itemRequests.ts";
import type {
  CreateTarget,
  EditTarget,
} from "../../../../src/features/blueprints/pathEditorTypes.ts";

const { service } = vi.hoisted(() => ({
  service: {
    updatePhase: vi.fn(),
    updateStep: vi.fn(),
    updateQuestion: vi.fn(),
    updateTask: vi.fn(),
    updateOption: vi.fn(),
    updateResource: vi.fn(),
    createPhase: vi.fn(),
    createStep: vi.fn(),
    createQuestion: vi.fn(),
    createTask: vi.fn(),
    createResource: vi.fn(),
    createOption: vi.fn(),
  },
}));

vi.mock("../../../../src/services/blueprintService.ts", () => ({ blueprintService: service }));

const scope = { kind: "global" } as const;
const values = {
  ...BLANK_VALUES,
  title: "T",
  description: "D",
  url: "https://u",
  outcome: "O",
  minutes: "20",
  stepType: "VIDEO",
  questionType: "SHORT_TEXT",
  questionTitle: "Node",
  explanation: "E",
  correctAnswer: "A",
  isCorrect: true,
};

function editing(kind: string, item: Record<string, unknown>) {
  return { kind, item } as unknown as NonNullable<EditTarget>;
}

function creating(kind: string, graphPosition?: { graphX: number; graphY: number }) {
  return { kind, parentId: "parent", position: 4, graphPosition } as NonNullable<CreateTarget>;
}

describe("valuesForEdit", () => {
  it("seeds a phase with its own fields", () => {
    const seeded = valuesForEdit(
      editing("phase", { title: "P", description: null, type: "AI_ENHANCED", aiPrompt: "go" }),
    );
    expect(seeded).toMatchObject({
      title: "P",
      description: "",
      phaseType: "AI_ENHANCED",
      aiPrompt: "go",
    });
  });

  it("seeds a phase that has no prompt with an empty one", () => {
    expect(
      valuesForEdit(
        editing("phase", { title: "P", description: "d", type: "FIXED", aiPrompt: null }),
      ).aiPrompt,
    ).toBe("");
  });

  it("seeds a step with its type, minutes and outcome", () => {
    const seeded = valuesForEdit(
      editing("step", {
        title: "S",
        description: "d",
        type: "VIDEO",
        estimatedMinutes: 45,
        expectedOutcome: "out",
      }),
    );
    expect(seeded).toMatchObject({ stepType: "VIDEO", minutes: "45", outcome: "out" });
  });

  it("keeps a question's node title and wording in separate fields", () => {
    const seeded = valuesForEdit(
      editing("question", {
        title: "Node",
        question: "Why?",
        type: "SHORT_TEXT",
        explanation: null,
        correctAnswer: null,
      }),
    );
    expect(seeded).toMatchObject({
      questionTitle: "Node",
      title: "Why?",
      questionType: "SHORT_TEXT",
      explanation: "",
      correctAnswer: "",
    });
  });

  it("seeds a question's explanation and answer when it has them", () => {
    const seeded = valuesForEdit(
      editing("question", {
        title: "N",
        question: "Q",
        type: "MULTIPLE_CHOICE",
        explanation: "why",
        correctAnswer: "main",
      }),
    );
    expect(seeded).toMatchObject({ explanation: "why", correctAnswer: "main" });
  });

  it("seeds an option with its label and whether it is correct", () => {
    expect(valuesForEdit(editing("option", { label: "L", correct: true }))).toMatchObject({
      title: "L",
      isCorrect: true,
    });
  });

  it("seeds a resource with its link and a task with its description", () => {
    expect(
      valuesForEdit(editing("resource", { title: "R", description: "d", url: "https://r" })),
    ).toMatchObject({ title: "R", description: "d", url: "https://r" });
    expect(valuesForEdit(editing("task", { title: "K", description: "k" }))).toMatchObject({
      title: "K",
      description: "k",
    });
  });

  it("leaves everything else at its blank value", () => {
    expect(valuesForEdit(editing("task", { title: "K", description: "k" }))).toEqual({
      ...BLANK_VALUES,
      title: "K",
      description: "k",
    });
  });
});

describe("updateItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a phase, dropping the prompt of a fixed one", async () => {
    await updateItem(scope, editing("phase", { id: "p", revision: 1, position: 2 }), {
      ...values,
      phaseType: "FIXED",
      description: "",
    });
    expect(service.updatePhase).toHaveBeenCalledWith(scope, "p", {
      revision: 1,
      position: 2,
      title: "T",
      description: null,
      type: "FIXED",
      aiPrompt: null,
    });
  });

  it("updates an AI phase with its prompt, or none when blank", async () => {
    const phase = editing("phase", { id: "p", revision: 1, position: 2 });
    await updateItem(scope, phase, { ...values, phaseType: "AI_ENHANCED", aiPrompt: "go" });
    expect(service.updatePhase.mock.calls[0][2]).toMatchObject({ aiPrompt: "go" });
    await updateItem(scope, phase, { ...values, phaseType: "AI_ENHANCED", aiPrompt: "" });
    expect(service.updatePhase.mock.calls[1][2]).toMatchObject({ aiPrompt: null });
  });

  it("updates a step, converting the minutes", async () => {
    await updateItem(
      scope,
      editing("step", { id: "s", revision: 2, position: 1, aiAssisted: true }),
      values,
    );
    expect(service.updateStep).toHaveBeenCalledWith(scope, "s", {
      revision: 2,
      position: 1,
      title: "T",
      description: "D",
      type: "VIDEO",
      estimatedMinutes: 20,
      expectedOutcome: "O",
      aiAssisted: true,
    });
  });

  it("updates a question from its node title and wording", async () => {
    await updateItem(scope, editing("question", { id: "q", revision: 3, position: 0 }), values);
    expect(service.updateQuestion).toHaveBeenCalledWith(scope, "q", {
      revision: 3,
      position: 0,
      title: "Node",
      type: "SHORT_TEXT",
      question: "T",
      explanation: "E",
      correctAnswer: "A",
    });
    await updateItem(scope, editing("question", { id: "q", revision: 3, position: 0 }), {
      ...values,
      explanation: "",
      correctAnswer: "",
    });
    expect(service.updateQuestion.mock.calls[1][2]).toMatchObject({
      explanation: null,
      correctAnswer: null,
    });
  });

  it("updates a task, an option and a resource", async () => {
    await updateItem(scope, editing("task", { id: "t", revision: 4, position: 1 }), values);
    expect(service.updateTask).toHaveBeenCalledWith(scope, "t", {
      revision: 4,
      position: 1,
      title: "T",
      description: "D",
    });
    await updateItem(scope, editing("option", { id: "o", revision: 5, position: 2 }), values);
    expect(service.updateOption).toHaveBeenCalledWith(scope, "o", {
      revision: 5,
      position: 2,
      label: "T",
      correct: true,
    });
    await updateItem(scope, editing("resource", { id: "r", revision: 6 }), values);
    expect(service.updateResource).toHaveBeenCalledWith(scope, "r", {
      revision: 6,
      title: "T",
      description: "D",
      url: "https://u",
    });
  });
});

describe("createItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a phase and hands it back, with the canvas position when given", async () => {
    service.createPhase.mockResolvedValue({ id: "new" });
    const created = await createItem(scope, creating("phase", { graphX: 1, graphY: 2 }), {
      ...values,
      phaseType: "AI_ENHANCED",
      aiPrompt: "go",
    });
    expect(service.createPhase).toHaveBeenCalledWith(scope, "parent", {
      position: 4,
      title: "T",
      description: "D",
      aiPrompt: "go",
      type: "AI_ENHANCED",
      graphX: 1,
      graphY: 2,
    });
    expect(created).toEqual({ kind: "phase", item: { id: "new" } });
  });

  it("creates a fixed phase with no prompt and no description", async () => {
    service.createPhase.mockResolvedValue({ id: "new" });
    await createItem(scope, creating("phase"), { ...values, description: "" });
    expect(service.createPhase.mock.calls[0][2]).toEqual({
      position: 4,
      title: "T",
      description: null,
      aiPrompt: null,
      type: "FIXED",
    });
  });

  it("creates a step and hands it back", async () => {
    service.createStep.mockResolvedValue({ id: "st" });
    const created = await createItem(scope, creating("step"), values);
    expect(service.createStep).toHaveBeenCalledWith(scope, "parent", {
      position: 4,
      title: "T",
      description: "D",
      type: "VIDEO",
      estimatedMinutes: 20,
      expectedOutcome: "O",
    });
    expect(created).toEqual({ kind: "step", item: { id: "st" } });
  });

  it("creates a question named by its node title, or by its wording without one", async () => {
    service.createQuestion.mockResolvedValue({ id: "qq" });
    const created = await createItem(scope, creating("question"), values);
    expect(service.createQuestion).toHaveBeenCalledWith(scope, "parent", {
      position: 4,
      title: "Node",
      type: "SHORT_TEXT",
      question: "T",
      explanation: "E",
      correctAnswer: "A",
    });
    expect(created).toEqual({ kind: "question", item: { id: "qq" } });
    await createItem(scope, creating("question"), {
      ...values,
      questionTitle: "",
      explanation: "",
      correctAnswer: "",
    });
    expect(service.createQuestion.mock.calls[1][2]).toMatchObject({
      title: "T",
      explanation: null,
      correctAnswer: null,
    });
  });

  it("creates a task, a resource and an option without handing anything back", async () => {
    expect(await createItem(scope, creating("task"), values)).toEqual({ kind: "other" });
    expect(service.createTask).toHaveBeenCalledWith(scope, "parent", {
      position: 4,
      title: "T",
      description: "D",
    });
    expect(await createItem(scope, creating("resource"), values)).toEqual({ kind: "other" });
    expect(service.createResource).toHaveBeenCalledWith(scope, "parent", {
      title: "T",
      description: "D",
      url: "https://u",
    });
    expect(await createItem(scope, creating("option"), values)).toEqual({ kind: "other" });
    expect(service.createOption).toHaveBeenCalledWith(scope, "parent", {
      position: 4,
      label: "T",
      correct: true,
    });
  });
});
