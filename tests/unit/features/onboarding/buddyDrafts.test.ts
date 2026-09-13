import { describe, expect, it } from "vitest";
import {
  askAboutEmptyPhase,
  askAboutPhase,
  askAboutQuestion,
  askAboutStep,
  askAboutWrongAnswer,
} from "../../../../src/features/onboarding/buddyDrafts";
import type {
  OnboardingPhaseEndpoint,
  OnboardingQuestionEndpoint,
  OnboardingStepEndpoint,
} from "../../../../src/features/onboarding/types";

/**
 * The opening sentence of a conversation about something on the path.
 *
 * Two things are worth pinning. It is written in the hire's voice, because the draft lands in their
 * composer and they send it — a sentence that reads like an instruction from the page is one they
 * stop trusting as their own. And somebody else's title is quoted, not pasted: a path step whose
 * title runs to three lines would otherwise arrive as a composer full of it.
 */
describe("buddy drafts", () => {
  const phase = (over: Partial<OnboardingPhaseEndpoint> = {}) =>
    ({
      id: "p1",
      pathId: "path",
      position: 0,
      title: "Environment Setup",
      description: "",
      locked: false,
      steps: [],
      questions: [],
      ...over,
    }) satisfies OnboardingPhaseEndpoint;

  const step = (over: Partial<OnboardingStepEndpoint> = {}) =>
    ({
      id: "s1",
      phaseId: "p1",
      position: 0,
      title: "Clone the repository",
      description: "",
      type: "TASK",
      estimatedMinutes: 20,
      expectedOutcomes: [],
      tasks: [],
      resources: [],
      status: "WAITING",
      startedAt: null,
      completedAt: null,
      feedback: null,
      skip: null,
      ...over,
    }) satisfies OnboardingStepEndpoint;

  const question = (over: Partial<OnboardingQuestionEndpoint> = {}) =>
    ({
      id: "q1",
      phaseId: "p1",
      position: 0,
      type: "MULTIPLE_CHOICE",
      question: "Which meeting sets the sprint scope?",
      status: "OPEN",
      ...over,
    }) satisfies OnboardingQuestionEndpoint;

  it("asks in the hire's own voice, not the page's", () => {
    for (const draft of [
      askAboutPhase(phase()),
      askAboutStep(step()),
      askAboutQuestion(question(), "Meetings"),
      askAboutWrongAnswer(question(), "Meetings"),
      askAboutEmptyPhase("Deployment"),
    ]) {
      expect(draft).toMatch(/^(I|The|We)\b/);
      expect(draft).toContain("?");
    }
  });

  it("names the thing it is about, so the mentor does not have to ask", () => {
    expect(askAboutPhase(phase())).toContain("Environment Setup");
    expect(askAboutStep(step())).toContain("Clone the repository");
    expect(askAboutQuestion(question(), "Meetings")).toContain("Which meeting sets the sprint scope?");
    expect(askAboutQuestion(question(), "Meetings")).toContain("Meetings");
  });

  it("says the hire wants to understand the question, not be handed the answer", () => {
    // The mentor is not given the correct answer and will say so if asked. Opening this way is the
    // cheapest way for a hire's first experience of the feature not to be a refusal.
    expect(askAboutQuestion(question(), "Meetings")).toContain("rather work the answer out");
    expect(askAboutWrongAnswer(question(), "Meetings")).toContain("understand it");
  });

  it("says an empty phase generated nothing, which is the fact the mentor needs", () => {
    const draft = askAboutEmptyPhase("Deployment");

    expect(draft).toContain("Deployment");
    expect(draft).toContain("empty");
    // It asks to work out what the phase should contain -- which is what `add_path_step` is for.
    expect(draft).toContain("what it should contain");
  });

  it("quotes a long title rather than pasting it", () => {
    const long = "Read ".repeat(60).trim();

    const draft = askAboutStep(step({ title: long }));

    expect(draft).toContain("…");
    expect(draft.length).toBeLessThan(long.length);
  });

  it("leaves a short title exactly as it was written", () => {
    expect(askAboutStep(step({ title: "Clone the repository" }))).toContain(
      '"Clone the repository"',
    );
  });
});
