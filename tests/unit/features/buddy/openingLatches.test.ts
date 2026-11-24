import { describe, expect, it } from "vitest";
import { createOpeningLatches } from "../../../../src/features/buddy/conversation/openingLatches";

describe("createOpeningLatches", () => {
  it("lets the opening read be claimed once until it is given back", () => {
    const latches = createOpeningLatches();

    expect(latches.claimLoad()).toBe(true);
    expect(latches.claimLoad()).toBe(false);
    latches.releaseLoad();
    expect(latches.claimLoad()).toBe(true);
  });

  it("holds and lets go of the busy latch", () => {
    const latches = createOpeningLatches();

    expect(latches.isBusy()).toBe(false);
    latches.setBusy(true);
    expect(latches.isBusy()).toBe(true);
    latches.setBusy(false);
    expect(latches.isBusy()).toBe(false);
  });

  it("remembers which move Try again redoes, and starts with none", () => {
    const latches = createOpeningLatches();

    expect(latches.retryMove()).toBeNull();
    latches.setRetryMove("newConversation");
    expect(latches.retryMove()).toBe("newConversation");
    latches.setRetryMove(null);
    expect(latches.retryMove()).toBeNull();
  });

  it("keeps separate latches independent", () => {
    const a = createOpeningLatches();
    const b = createOpeningLatches();

    a.claimLoad();
    a.setBusy(true);

    expect(b.claimLoad()).toBe(true);
    expect(b.isBusy()).toBe(false);
  });
});
