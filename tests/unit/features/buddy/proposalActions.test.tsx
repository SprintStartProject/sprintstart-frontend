import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmProposal,
  dismissStored,
} from "../../../../src/features/buddy/conversation/proposalDecisions";
import { PROPOSAL_GONE } from "../../../../src/features/buddy/conversation/replyMessages";
import { useProposalActions } from "../../../../src/features/buddy/hooks/useProposalActions";
import { useThreadReset } from "../../../../src/features/buddy/hooks/useThreadReset";
import { announceBuddyPathChanged } from "../../../../src/features/buddy/aiBuddyBus";
import {
  confirmStoredProposal,
  dismissStoredProposal,
  performAction,
} from "../../../../src/services/buddyService";
import {
  BUDDY_ACTION_PLACE_NOTE,
  BUDDY_PATH_ACTIONS,
  type BuddyMessageView,
  type HireActionProposal,
  type StoredActionProposal,
} from "../../../../src/features/buddy/types";

vi.mock("../../../../src/services/buddyService", () => ({
  confirmStoredProposal: vi.fn(),
  dismissStoredProposal: vi.fn(),
  performAction: vi.fn(),
}));

vi.mock("../../../../src/features/buddy/aiBuddyBus", () => ({
  announceBuddyPathChanged: vi.fn(),
}));

const hire = (over: Partial<HireActionProposal> = {}): HireActionProposal => ({
  id: "a1",
  action: "flag_to_pm",
  label: "Flag it",
  status: "idle",
  ...over,
});

const stored = (over: Partial<StoredActionProposal> = {}): StoredActionProposal => ({
  id: "s1",
  proposalId: "p1",
  label: "Apply",
  preview: "It changes things",
  risk: "STANDARD",
  status: "idle",
  ...over,
});

const effects = () => ({
  patchAction: vi.fn(),
  clearActionDraft: vi.fn(),
  invalidateBoard: vi.fn(),
});

const notFound = () => Object.assign(new Error("gone"), { status: 404 });

beforeEach(() => {
  vi.mocked(performAction).mockReset();
  vi.mocked(confirmStoredProposal).mockReset();
  vi.mocked(dismissStoredProposal).mockReset();
  vi.mocked(announceBuddyPathChanged).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("confirmProposal", () => {
  it("sends a hire offer's payload and shows the outcome", async () => {
    vi.mocked(performAction).mockResolvedValue({ ok: true, message: "Done" });
    const fx = effects();

    await confirmProposal("m1", hire({ question: "why?", label: "Flag it" }), fx);

    expect(performAction).toHaveBeenCalledWith(
      "flag_to_pm",
      expect.objectContaining({ question: "why?" }),
    );
    expect(fx.patchAction).toHaveBeenCalledWith("m1", "a1", {
      status: "resolved",
      ok: true,
      outcome: "Done",
    });
  });

  it("confirms a stored proposal by its id alone", async () => {
    vi.mocked(confirmStoredProposal).mockResolvedValue({ ok: true, message: "Applied" });
    const fx = effects();

    await confirmProposal("m1", stored(), fx);

    expect(confirmStoredProposal).toHaveBeenCalledWith("p1");
    expect(performAction).not.toHaveBeenCalled();
    expect(fx.patchAction).toHaveBeenCalledWith("m1", "s1", expect.objectContaining({ ok: true }));
  });

  it("forgets the wording that went out, but only when it went through", async () => {
    const fx = effects();
    vi.mocked(performAction).mockResolvedValueOnce({ ok: true, message: "Done" });
    await confirmProposal("m1", hire(), fx);
    expect(fx.clearActionDraft).toHaveBeenCalledWith(expect.stringContaining("a1"));

    const refused = effects();
    vi.mocked(performAction).mockResolvedValueOnce({ ok: false, message: "Not now" });
    await confirmProposal("m1", hire(), refused);
    expect(refused.clearActionDraft).not.toHaveBeenCalled();
    expect(refused.patchAction).toHaveBeenCalledWith("m1", "a1", {
      status: "resolved",
      ok: false,
      outcome: "Not now",
    });
  });

  it("tells the page behind the dock when a path action succeeded", async () => {
    vi.mocked(performAction).mockResolvedValue({ ok: true, message: "Done" });

    await confirmProposal("m1", hire({ action: BUDDY_PATH_ACTIONS[0] }), effects());

    expect(announceBuddyPathChanged).toHaveBeenCalledTimes(1);
  });

  it("tells nobody when the action does not touch the path or a refusal came back", async () => {
    vi.mocked(performAction).mockResolvedValue({ ok: true, message: "Done" });
    await confirmProposal("m1", hire({ action: "flag_to_pm" }), effects());

    vi.mocked(performAction).mockResolvedValue({ ok: false, message: "No" });
    await confirmProposal("m1", hire({ action: BUDDY_PATH_ACTIONS[0] }), effects());

    expect(announceBuddyPathChanged).not.toHaveBeenCalled();
  });

  it("reads the board again after a board action went through only", async () => {
    const ok = effects();
    vi.mocked(performAction).mockResolvedValueOnce({ ok: true, message: "Done" });
    await confirmProposal("m1", hire({ action: BUDDY_ACTION_PLACE_NOTE }), ok);
    expect(ok.invalidateBoard).toHaveBeenCalledTimes(1);

    const refused = effects();
    vi.mocked(performAction).mockResolvedValueOnce({ ok: false, message: "No" });
    await confirmProposal("m1", hire({ action: BUDDY_ACTION_PLACE_NOTE }), refused);
    expect(refused.invalidateBoard).not.toHaveBeenCalled();

    const other = effects();
    vi.mocked(performAction).mockResolvedValueOnce({ ok: true, message: "Done" });
    await confirmProposal("m1", hire({ action: "flag_to_pm" }), other);
    expect(other.invalidateBoard).not.toHaveBeenCalled();
  });

  it("resolves a proposal that no longer exists instead of offering a retry", async () => {
    vi.mocked(confirmStoredProposal).mockRejectedValue(notFound());
    const fx = effects();

    await confirmProposal("m1", stored(), fx);

    expect(fx.patchAction).toHaveBeenCalledWith("m1", "s1", {
      status: "resolved",
      ok: false,
      outcome: PROPOSAL_GONE,
    });
  });

  it("marks any other failure as retryable", async () => {
    vi.mocked(performAction).mockRejectedValue(new Error("offline"));
    const fx = effects();

    await confirmProposal("m1", hire(), fx);

    expect(fx.patchAction).toHaveBeenCalledWith("m1", "a1", { status: "error" });
  });
});

describe("dismissStored", () => {
  it("puts away a proposal the backend declined", async () => {
    vi.mocked(dismissStoredProposal).mockResolvedValue({ ok: true, message: "" });
    const patch = vi.fn();

    await dismissStored("m1", stored(), patch);

    expect(dismissStoredProposal).toHaveBeenCalledWith("p1");
    expect(patch).toHaveBeenCalledWith("m1", "s1", { status: "dismissed" });
  });

  it("says why when the backend would not decline it", async () => {
    vi.mocked(dismissStoredProposal).mockResolvedValue({ ok: false, message: "Already applied" });
    const patch = vi.fn();

    await dismissStored("m1", stored(), patch);

    expect(patch).toHaveBeenCalledWith("m1", "s1", {
      status: "resolved",
      ok: false,
      outcome: "Already applied",
    });
  });

  it("resolves a proposal that no longer exists", async () => {
    vi.mocked(dismissStoredProposal).mockRejectedValue(notFound());
    const patch = vi.fn();

    await dismissStored("m1", stored(), patch);

    expect(patch).toHaveBeenCalledWith("m1", "s1", {
      status: "resolved",
      ok: false,
      outcome: PROPOSAL_GONE,
    });
  });

  it("leaves the offer on the table after any other failure", async () => {
    vi.mocked(dismissStoredProposal).mockRejectedValue(new Error("offline"));
    const patch = vi.fn();

    await dismissStored("m1", stored(), patch);

    expect(patch).toHaveBeenCalledWith("m1", "s1", { status: "idle" });
  });
});

describe("useProposalActions", () => {
  const withActions = (...actions: (HireActionProposal | StoredActionProposal)[]) => [
    {
      id: "m1",
      role: "ASSISTANT",
      content: "",
      createdAt: "t",
      actions,
    } as BuddyMessageView,
  ];

  function setup(actions: (HireActionProposal | StoredActionProposal)[]) {
    const invalidateBoard = vi.fn();

    return {
      invalidateBoard,
      ...renderHook(() => {
        const [messages, setMessages] = useState<BuddyMessageView[]>(withActions(...actions));
        const proposals = useProposalActions({ setMessages, invalidateBoard });

        return { messages, ...proposals };
      }),
    };
  }

  const statusOf = (messages: BuddyMessageView[], id: string) =>
    messages[0].actions?.find((a) => a.id === id)?.status;

  it("moves a confirmed offer through confirming to resolved", async () => {
    let finish: (value: { ok: boolean; message: string }) => void = () => {};
    vi.mocked(performAction).mockReturnValue(new Promise((done) => (finish = done)));
    const { result } = setup([hire()]);

    act(() => result.current.confirmAction("m1", hire()));
    expect(statusOf(result.current.messages, "a1")).toBe("confirming");
    expect(result.current.isDeciding).toBe(true);
    expect(result.current.decidingNow()).toBe(true);

    await act(() => Promise.resolve(finish({ ok: true, message: "Done" })));

    await waitFor(() => expect(statusOf(result.current.messages, "a1")).toBe("resolved"));
    expect(result.current.isDeciding).toBe(false);
    expect(result.current.decidingNow()).toBe(false);
  });

  it("ignores a second press while the first is on its way", () => {
    vi.mocked(performAction).mockReturnValue(new Promise(() => {}));
    const { result } = setup([hire()]);

    act(() => {
      result.current.confirmAction("m1", hire());
      result.current.confirmAction("m1", hire());
    });

    expect(performAction).toHaveBeenCalledTimes(1);
  });

  it("keeps counting while two different decisions are in flight", async () => {
    let finishFirst: (value: { ok: boolean; message: string }) => void = () => {};
    vi.mocked(performAction)
      .mockReturnValueOnce(new Promise((done) => (finishFirst = done)))
      .mockReturnValueOnce(new Promise(() => {}));
    const { result } = setup([hire({ id: "a1" }), hire({ id: "a2" })]);

    act(() => {
      result.current.confirmAction("m1", hire({ id: "a1" }));
      result.current.confirmAction("m1", hire({ id: "a2" }));
    });
    await act(() => Promise.resolve(finishFirst({ ok: true, message: "Done" })));

    expect(result.current.isDeciding).toBe(true);
    expect(result.current.decidingNow()).toBe(true);
  });

  it("does nothing for an offer that cannot be confirmed", () => {
    const { result } = setup([hire({ status: "dismissed" })]);

    act(() => result.current.confirmAction("m1", hire({ status: "dismissed" })));

    expect(performAction).not.toHaveBeenCalled();
    expect(result.current.isDeciding).toBe(false);
  });

  it("declines a hire offer on screen only, and forgets its wording", () => {
    const { result } = setup([hire()]);
    act(() => result.current.setActionDraft("m1:a1", "my words"));
    expect(result.current.actionDrafts).toEqual({ "m1:a1": "my words" });

    act(() => result.current.dismissAction("m1", hire()));

    expect(statusOf(result.current.messages, "a1")).toBe("dismissed");
    expect(dismissStoredProposal).not.toHaveBeenCalled();
    expect(result.current.actionDrafts).toEqual({});
  });

  it("declines a stored offer at the backend, holding the gate while it does", async () => {
    let finish: (value: { ok: boolean; message: string }) => void = () => {};
    vi.mocked(dismissStoredProposal).mockReturnValue(new Promise((done) => (finish = done)));
    const { result } = setup([stored()]);

    act(() => result.current.dismissAction("m1", stored()));
    expect(statusOf(result.current.messages, "s1")).toBe("confirming");
    expect(result.current.isDeciding).toBe(true);

    await act(() => Promise.resolve(finish({ ok: true, message: "" })));

    await waitFor(() => expect(statusOf(result.current.messages, "s1")).toBe("dismissed"));
    expect(result.current.isDeciding).toBe(false);
  });

  it("leaves a stored offer alone that is not waiting any more", () => {
    const { result } = setup([stored({ status: "resolved" })]);

    act(() => result.current.dismissAction("m1", stored({ status: "resolved" })));

    expect(dismissStoredProposal).not.toHaveBeenCalled();
  });

  it("keeps and forgets the wording of one field at a time", () => {
    const { result } = setup([]);

    act(() => {
      result.current.setActionDraft("a", "1");
      result.current.setActionDraft("b", "2");
    });
    expect(result.current.actionDrafts).toEqual({ a: "1", b: "2" });

    act(() => result.current.clearActionDrafts());
    expect(result.current.actionDrafts).toEqual({});
  });
});

describe("useThreadReset", () => {
  it("puts away everything the conversation on screen had", () => {
    const parts = {
      setMessages: vi.fn(),
      setOpenerAction: vi.fn(),
      setOpenError: vi.fn(),
      setActiveTool: vi.fn(),
      setPresentedGreetingId: vi.fn(),
      commitQueued: vi.fn(),
      setQueuePaused: vi.fn(),
      clearActionDrafts: vi.fn(),
      closeDinoGame: vi.fn(),
    };
    const { result } = renderHook(() => useThreadReset(parts));

    result.current();

    expect(parts.setMessages).toHaveBeenCalledWith([]);
    expect(parts.setOpenerAction).toHaveBeenCalledWith(null);
    expect(parts.setOpenError).toHaveBeenCalledWith(null);
    expect(parts.setActiveTool).toHaveBeenCalledWith(null);
    expect(parts.setPresentedGreetingId).toHaveBeenCalledWith(null);
    expect(parts.commitQueued).toHaveBeenCalledWith([]);
    expect(parts.setQueuePaused).toHaveBeenCalledWith(false);
    expect(parts.clearActionDrafts).toHaveBeenCalledTimes(1);
    expect(parts.closeDinoGame).toHaveBeenCalledTimes(1);
  });
});
