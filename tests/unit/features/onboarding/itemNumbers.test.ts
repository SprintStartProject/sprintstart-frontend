import { describe, expect, it } from "vitest";
import { itemNumbers } from "../../../../src/features/onboarding/itemNumbers";
import type { OnboardingPhaseEndpoint } from "../../../../src/features/onboarding/types";

/**
 * The number an item is shown with.
 *
 * It exists so a hire can say "let's do 3" instead of retyping a title — which only works while this
 * agrees with `BuddyPathTools`, where the same rule is written in Kotlin. Steps first in position
 * order, then questions.
 */
describe("itemNumbers", () => {
  function phase(over: Partial<OnboardingPhaseEndpoint> = {}): OnboardingPhaseEndpoint {
    return {
      id: "p1",
      pathId: "path",
      position: 0,
      title: "Setup",
      description: "",
      locked: false,
      steps: [],
      questions: [],
      ...over,
    };
  }

  const step = (id: string, position: number) => ({ id, position }) as never;
  const question = (id: string, position: number) => ({ id, position }) as never;

  it("numbers the steps first, then the questions", () => {
    const numbers = itemNumbers(
      phase({
        steps: [step("s1", 0), step("s2", 1)],
        questions: [question("q1", 0)],
      }),
    );

    expect(numbers.get("s1")).toBe(1);
    expect(numbers.get("s2")).toBe(2);
    // The question continues the same sequence rather than starting a second one, because the page
    // shows one list of items and a hire counts down what they see.
    expect(numbers.get("q1")).toBe(3);
  });

  it("goes by position, not by the order the payload happened to arrive in", () => {
    const numbers = itemNumbers(phase({ steps: [step("late", 5), step("early", 1)] }));

    expect(numbers.get("early")).toBe(1);
    expect(numbers.get("late")).toBe(2);
  });

  it("gives steps and questions distinct numbers even when their positions collide", () => {
    // They carry their own positions underneath, so a shared one is ordinary. A hire counting down
    // one visible list must still get one number per item.
    const numbers = itemNumbers(phase({ steps: [step("s1", 0)], questions: [question("q1", 0)] }));

    expect([...numbers.values()]).toEqual([1, 2]);
  });

  it("is empty for a phase with nothing in it", () => {
    expect(itemNumbers(phase()).size).toBe(0);
  });
});
