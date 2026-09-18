import { describe, it, expect } from "vitest";
import { howStepGetsDone } from "../../../../src/features/arrival/howItsDone";

describe("howStepGetsDone", () => {
  it("names the GitHub check for the github-account derivation", () => {
    expect(
      howStepGetsDone({ key: "github-account", settledBy: "OBSERVED", selfConfirmable: false })
        .label,
    ).toBe("Done once GitHub confirms their username");
  });

  it("names the pull-request check for the environment-ready derivation", () => {
    expect(
      howStepGetsDone({ key: "environment-ready", settledBy: "OBSERVED", selfConfirmable: true })
        .label,
    ).toBe("Done when they tick it, or with their first pull request");
  });

  it("says an ordinary observed-and-self-confirmable step can go either way", () => {
    expect(
      howStepGetsDone({ key: "vpn", settledBy: "OBSERVED", selfConfirmable: true }).label,
    ).toBe("Checked by SprintStart, or ticked by them");
  });

  it("says an ordinary observed-only step is checked by SprintStart alone", () => {
    expect(
      howStepGetsDone({ key: "vpn", settledBy: "OBSERVED", selfConfirmable: false }).label,
    ).toBe("Checked by SprintStart only");
  });

  it("says a declared step is ticked off by the hire", () => {
    expect(
      howStepGetsDone({ key: "vpn", settledBy: "DECLARED", selfConfirmable: true }).label,
    ).toBe("They tick it off themselves");
  });
});
