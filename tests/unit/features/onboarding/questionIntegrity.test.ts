import { afterEach, describe, expect, it } from "vitest";
import {
  clearRevealed,
  isCopyOfReveal,
  isCopyOfSample,
  isPasteFromReveal,
  readRevealed,
  revealedTexts,
  shuffleOptions,
  writeRevealed,
} from "../../../../src/features/onboarding/questionIntegrity.ts";
import type { OnboardingQuestionOptionEndpoint } from "../../../../src/features/onboarding/types.ts";

function options(...labels: string[]): OnboardingQuestionOptionEndpoint[] {
  return labels.map((label, index) => ({ id: `o${index + 1}`, position: index, label }));
}

describe("shuffleOptions", () => {
  const four = options("Right", "Wrong A", "Wrong B", "Wrong C");

  it("keeps every option, once", () => {
    const shuffled = shuffleOptions(four, "q1");

    expect(shuffled.map((option) => option.id).sort()).toEqual(["o1", "o2", "o3", "o4"]);
  });

  it("holds still for the same seed, so the order does not jump while answering", () => {
    expect(shuffleOptions(four, "q1")).toEqual(shuffleOptions(four, "q1"));
  });

  /**
   * The generated questions list the right answer first. Over many questions, a shuffled first
   * slot should hold it about a quarter of the time -- not every time.
   */
  it("does not leave the first option first", () => {
    const firstStaysFirst = Array.from({ length: 400 }, (_, index) => `question-${index}`).filter(
      (seed) => shuffleOptions(four, seed)[0].id === "o1",
    ).length;

    expect(firstStaysFirst).toBeGreaterThan(60);
    expect(firstStaysFirst).toBeLessThan(140);
  });

  it("gives another attempt another order", () => {
    const orders = new Set(
      Array.from({ length: 10 }, (_, round) =>
        shuffleOptions(four, `q1:${round}`)
          .map((option) => option.id)
          .join(),
      ),
    );

    expect(orders.size).toBeGreaterThan(1);
  });

  it('keeps "all of the above" and its kind at the end', () => {
    const withCatchAll = options("Right", "Wrong A", "All of the above", "Wrong B");

    for (let round = 0; round < 20; round += 1) {
      const shuffled = shuffleOptions(withCatchAll, `q1:${round}`);
      expect(shuffled[shuffled.length - 1].label).toBe("All of the above");
    }
  });

  it("starts from the stored positions, not the order the options arrived in", () => {
    const reversed = [...four].reverse();

    expect(shuffleOptions(reversed, "q1")).toEqual(shuffleOptions(four, "q1"));
  });
});

describe("isCopyOfSample", () => {
  const sample = "The Scrum Master facilitates the retro and keeps it timeboxed";

  it("catches the sample handed back as it was", () => {
    expect(isCopyOfSample(sample, sample)).toBe(true);
  });

  it("catches it with the case, punctuation and spacing changed", () => {
    expect(
      isCopyOfSample("the scrum master  facilitates the retro, and keeps it timeboxed!", sample),
    ).toBe(true);
  });

  it("catches it with a word or two changed", () => {
    expect(isCopyOfSample("The Scrum Master runs the retro and keeps it timeboxed", sample)).toBe(
      true,
    );
  });

  it("catches it with something added around it", () => {
    expect(
      isCopyOfSample(
        `I think ${sample}, because that is what the guide says about retrospectives`,
        sample,
      ),
    ).toBe(true);
  });

  it("lets an answer in other words through", () => {
    expect(
      isCopyOfSample("Our SM leads it, and makes sure we stop when the time is up", sample),
    ).toBe(false);
  });

  it("never counts a short, factual sample: there is no other way to say it", () => {
    expect(isCopyOfSample("The Scrum Master", "The Scrum Master")).toBe(false);
  });

  it("has nothing to compare against without a sample", () => {
    expect(isCopyOfSample(sample, null)).toBe(false);
    expect(isCopyOfSample("", sample)).toBe(false);
  });
});

describe("isCopyOfReveal / isPasteFromReveal", () => {
  const explanation =
    "Retrospectives are facilitated by the Scrum Master, who keeps the meeting timeboxed.";
  const revealed = ["Scrum Master", explanation];

  it("catches an answer lifted out of the explanation", () => {
    expect(isCopyOfReveal("facilitated by the Scrum Master", revealed)).toBe(true);
    expect(isCopyOfReveal(explanation, revealed)).toBe(true);
  });

  it("lets a short fact be typed back, but not pasted", () => {
    expect(isCopyOfReveal("Scrum Master", revealed)).toBe(false);
    expect(isPasteFromReveal("Scrum Master", revealed)).toBe(true);
    expect(isPasteFromReveal("the Scrum Master, who keeps", revealed)).toBe(true);
  });

  it("lets the hire's own words through, typed or pasted", () => {
    const own = "Our SM leads it and stops us when time is up";
    expect(isCopyOfReveal(own, revealed)).toBe(false);
    expect(isPasteFromReveal(own, revealed)).toBe(false);
  });

  it("has nothing to compare against before anything was revealed", () => {
    expect(isPasteFromReveal("Scrum Master", [])).toBe(false);
  });
});

describe("revealedTexts", () => {
  it("collects the sample, the explanation and the feedback that are there", () => {
    expect(revealedTexts({ correctAnswer: "A", explanation: null, feedback: "  " })).toEqual(["A"]);
    expect(revealedTexts({ correctAnswer: "A", explanation: "B", feedback: "C" })).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
});

describe("revealed answer memory", () => {
  afterEach(() => window.localStorage.clear());

  it("remembers what was revealed per question, until it is cleared", () => {
    writeRevealed("q1", ["The sample", "The explanation"]);

    expect(readRevealed("q1")).toEqual(["The sample", "The explanation"]);
    expect(readRevealed("q2")).toEqual([]);

    clearRevealed("q1");
    expect(readRevealed("q1")).toEqual([]);
  });
});
