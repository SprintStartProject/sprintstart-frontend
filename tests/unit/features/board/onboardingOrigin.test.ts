import { afterEach, describe, expect, it } from "vitest";
import {
  onboardingOrigin,
  withOnboardingPlace,
} from "../../../../src/features/board/layout/onboardingOrigin";
import { setOnboardingPlace } from "../../../../src/features/onboarding/onboardingPlace";

afterEach(() => setOnboardingPlace(null));

describe("the step a card kept during onboarding belongs to", () => {
  it("is the step open on the Onboarding page", () => {
    setOnboardingPlace({ kind: "step", id: "s1", title: "Set up SSH" });

    expect(onboardingOrigin("/onboarding")).toEqual({
      url: "/onboarding?step=s1&open=1",
      label: "Set up SSH",
    });
  });

  it("is nothing anywhere else in the app", () => {
    setOnboardingPlace({ kind: "step", id: "s1", title: "Set up SSH" });

    expect(onboardingOrigin("/chat")).toBeNull();
  });

  it("points a selection at the open step and keeps its words", () => {
    setOnboardingPlace({ kind: "phase", id: "p1", title: "Setup" });

    expect(withOnboardingPlace("/onboarding#:~:text=ssh")).toBe("/onboarding?phase=p1#:~:text=ssh");
    expect(withOnboardingPlace("/knowledge#:~:text=ssh")).toBe("/knowledge#:~:text=ssh");
  });
});
