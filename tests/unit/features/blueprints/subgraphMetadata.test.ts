import { describe, expect, it } from "vitest";
import {
  fieldSetter,
  isQuestionChanged,
  isStepChanged,
  questionMetadataOf,
  stepMetadataOf,
} from "../../../../src/features/blueprints/subgraph/metadata.ts";
import type {
  BlueprintQuestion,
  BlueprintStep,
} from "../../../../src/services/blueprintTypes.ts";

const step = {
  id: "s1",
  title: "Read the docs",
  description: "Start here",
  type: "DOCUMENT",
  aiAssisted: true,
  estimatedMinutes: 15,
  expectedOutcome: "Knows the layout",
  position: 1,
  blockerIds: [],
} as unknown as BlueprintStep;

const question = {
  id: "q1",
  title: "Basics",
  type: "MULTIPLE_CHOICE",
  question: "What is a hook?",
  explanation: null,
  correctAnswer: "a function",
  blueprintCheckOptions: [],
} as unknown as BlueprintQuestion;

describe("stepMetadataOf", () => {
  it("keeps exactly the editable fields", () => {
    expect(stepMetadataOf(step)).toEqual({
      title: "Read the docs",
      description: "Start here",
      type: "DOCUMENT",
      aiAssisted: true,
      estimatedMinutes: 15,
      expectedOutcome: "Knows the layout",
    });
  });
});

describe("questionMetadataOf", () => {
  it("keeps exactly the editable fields", () => {
    expect(questionMetadataOf(question)).toEqual({
      title: "Basics",
      type: "MULTIPLE_CHOICE",
      question: "What is a hook?",
      explanation: null,
      correctAnswer: "a function",
    });
  });
});

describe("isStepChanged", () => {
  it("is false for the stored values and for no step at all", () => {
    expect(isStepChanged(step, stepMetadataOf(step))).toBe(false);
    expect(isStepChanged(null, { ...stepMetadataOf(step), title: "x" })).toBe(false);
  });

  it("is true as soon as one field differs", () => {
    expect(isStepChanged(step, { ...stepMetadataOf(step), title: "Read more" })).toBe(true);
    expect(isStepChanged(step, { ...stepMetadataOf(step), estimatedMinutes: 16 })).toBe(true);
    expect(isStepChanged(step, { ...stepMetadataOf(step), aiAssisted: false })).toBe(true);
  });
});

describe("isQuestionChanged", () => {
  it("is false for the stored values and for no question at all", () => {
    expect(isQuestionChanged(question, questionMetadataOf(question))).toBe(false);
    expect(isQuestionChanged(null, { ...questionMetadataOf(question), title: "x" })).toBe(false);
  });

  it("is true as soon as one field differs", () => {
    expect(
      isQuestionChanged(question, { ...questionMetadataOf(question), explanation: "Why" }),
    ).toBe(true);
    expect(
      isQuestionChanged(question, { ...questionMetadataOf(question), type: "SHORT_TEXT" }),
    ).toBe(true);
  });
});

describe("fieldSetter", () => {
  it("replaces one field and keeps the others", () => {
    let current = { title: "a", note: "b" };
    const set = fieldSetter<typeof current>((update) => {
      current = update(current);
    });

    set("title")("changed");

    expect(current).toEqual({ title: "changed", note: "b" });
  });
});
