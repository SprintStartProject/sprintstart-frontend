import { describe, expect, it, vi } from "vitest";
import {
  reportOpenFailure,
  threadBusy,
} from "../../../../src/features/buddy/conversation/openFailure";
import { createOpeningLatches } from "../../../../src/features/buddy/conversation/openingLatches";
import { HISTORY_FAILED } from "../../../../src/features/buddy/conversation/replyMessages";

describe("reportOpenFailure", () => {
  it("puts the banner up and forgets a stale retry move", () => {
    const latches = createOpeningLatches();
    latches.setRetryMove("newConversation");
    const setOpenError = vi.fn();

    reportOpenFailure(latches, setOpenError);

    expect(setOpenError).toHaveBeenCalledWith(HISTORY_FAILED);
    expect(latches.retryMove()).toBeNull();
  });
});

describe("threadBusy", () => {
  const idle = {
    isThinking: false,
    isStreaming: false,
    isOpening: false,
    isGreeting: false,
    isDeciding: false,
  };

  it("is free when nothing is in flight", () => {
    expect(threadBusy(idle)).toBe(false);
  });

  it.each(Object.keys(idle))("is busy while %s alone is true", (flag) => {
    expect(threadBusy({ ...idle, [flag]: true })).toBe(true);
  });
});
