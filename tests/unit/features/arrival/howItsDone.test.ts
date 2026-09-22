import { describe, it, expect } from "vitest";
import { howStepGetsDone } from "../../../../src/features/arrival/howItsDone";

describe("howStepGetsDone", () => {
  it("names the GitHub check for the github-account derivation", () => {
    const result = howStepGetsDone({
      key: "github-account",
      settledBy: "OBSERVED",
      selfConfirmable: false,
    });
    expect(result.badge).toBe("GitHub");
    expect(result.label).toBe("Done once GitHub confirms their username");
  });

  it("names the pull-request check for the environment-ready derivation", () => {
    const result = howStepGetsDone({
      key: "environment-ready",
      settledBy: "OBSERVED",
      selfConfirmable: true,
    });
    expect(result.badge).toBe("First PR");
    expect(result.label).toBe("Done when they tick it, or with their first pull request");
  });

  it("says an ordinary observed-and-self-confirmable step can go either way", () => {
    const result = howStepGetsDone({ key: "vpn", settledBy: "OBSERVED", selfConfirmable: true });
    expect(result.badge).toBe("Auto or tick");
    expect(result.label).toBe("Checked by SprintStart, or ticked by them");
  });

  it("says an ordinary observed-only step is checked by SprintStart alone", () => {
    const result = howStepGetsDone({ key: "vpn", settledBy: "OBSERVED", selfConfirmable: false });
    expect(result.badge).toBe("Auto only");
    expect(result.label).toBe("Checked by SprintStart only");
  });

  it("says a declared step is ticked off by the hire", () => {
    const result = howStepGetsDone({ key: "vpn", settledBy: "DECLARED", selfConfirmable: true });
    expect(result.badge).toBe("Self-tick");
    expect(result.label).toBe("They tick it off themselves");
  });
});
