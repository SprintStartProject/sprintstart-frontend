import { afterEach, describe, expect, it } from "vitest";
import {
  clearRevealed,
  isCopyOfReveal,
  isCopyOfSample,
  isPasteFromReveal,
  NOTHING_REVEALED,
  readRevealed,
  type Revealed,
  shuffleOptions,
  withAttempt,
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

  it("keeps the German forms at the end too", () => {
    for (const label of ["Alle genannten", "Keine der oben genannten", "Keine davon"]) {
      const withCatchAll = options("Right", label, "Wrong A", "Wrong B");
      for (let round = 0; round < 10; round += 1) {
        const shuffled = shuffleOptions(withCatchAll, `q1:${round}`);
        expect(shuffled[shuffled.length - 1].label).toBe(label);
      }
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
  const revealed: Revealed = { samples: ["Scrum Master"], texts: [explanation], own: [] };

  it("catches a long sample typed back", () => {
    const sample = "The Scrum Master facilitates the retro and keeps it timeboxed";
    expect(isCopyOfReveal(sample, { ...NOTHING_REVEALED, samples: [sample] })).toBe(true);
  });

  /** Review on #309: the "lifted" check made the sample threshold 4 instead of the documented 5. */
  it("lets a four-word sample be typed back, as documented for short samples", () => {
    const sample = "Product Owner and Developers";
    expect(isCopyOfReveal(sample, { ...NOTHING_REVEALED, samples: [sample] })).toBe(false);
  });

  /**
   * A typed answer is never refused for sharing words with the explanation or feedback: that is
   * as likely the hire's own wording as a copy. Copying from there is the paste guard's job.
   */
  it("never refuses a typed answer for words it shares with the explanation", () => {
    expect(isCopyOfReveal("facilitated by the Scrum Master", revealed)).toBe(false);
    expect(isCopyOfReveal("Scrum Master", revealed)).toBe(false);
  });

  it("refuses any stretch of the sample or explanation arriving by paste", () => {
    expect(isPasteFromReveal("Scrum Master", revealed)).toBe(true);
    expect(isPasteFromReveal("the Scrum Master, who keeps", revealed)).toBe(true);
  });

  /** Review on #309: grading feedback quotes the hire's own wrong answer back. */
  it("lets the hire paste their own earlier answer, though the feedback quotes it", () => {
    const own = "the team lead decides the sprint scope";
    const feedback = `Your answer '${own}' is not right: in Scrum the Product Owner orders the backlog.`;
    const quoted: Revealed = { samples: [], texts: [feedback], own: [own] };

    expect(isPasteFromReveal(own, quoted)).toBe(false);
    expect(isCopyOfReveal("in Scrum the Product Owner", quoted)).toBe(false);
    expect(isPasteFromReveal("in Scrum the Product Owner orders the backlog", quoted)).toBe(true);
  });

  it("lets the hire's own words through, typed or pasted", () => {
    const own = "Our SM leads it and stops us when time is up";
    expect(isCopyOfReveal(own, revealed)).toBe(false);
    expect(isPasteFromReveal(own, revealed)).toBe(false);
  });

  it("has nothing to compare against before anything was revealed", () => {
    expect(isPasteFromReveal("Scrum Master", NOTHING_REVEALED)).toBe(false);
  });
});

describe("withAttempt", () => {
  it("keeps the sample apart from the explanation and feedback, and records the answer", () => {
    const first = withAttempt(
      NOTHING_REVEALED,
      { correctAnswer: "A", explanation: null, feedback: "  " },
      "my answer",
    );
    expect(first).toEqual({ samples: ["A"], texts: [], own: ["my answer"] });

    expect(
      withAttempt(first, { correctAnswer: "A", explanation: "B", feedback: "C" }, "another"),
    ).toEqual({ samples: ["A"], texts: ["B", "C"], own: ["my answer", "another"] });
  });
});

describe("revealed answer memory", () => {
  afterEach(() => window.localStorage.clear());

  it("remembers what was revealed per question, until it is cleared", () => {
    const revealed: Revealed = { samples: ["The sample"], texts: ["The explanation"], own: ["x"] };
    writeRevealed("q1", revealed);

    expect(readRevealed("q1")).toEqual(revealed);
    expect(readRevealed("q2")).toEqual(NOTHING_REVEALED);

    clearRevealed("q1");
    expect(readRevealed("q1")).toEqual(NOTHING_REVEALED);
  });
});
