import { describe, expect, it } from "vitest";
import {
  actionExtras,
  hireProposal,
  isStored,
  mayConfirm,
  mayDismissStored,
  movesPath,
  storedProposal,
  touchesBoard,
} from "../../../../src/features/buddy/conversation/proposals";
import {
  BUDDY_ACTION_PLACE_NOTE,
  BUDDY_PATH_ACTIONS,
  type HireActionProposal,
  type ProposedAction,
  type StoredActionProposal,
} from "../../../../src/features/buddy/types";

const hire = (over: Partial<HireActionProposal> = {}): HireActionProposal => ({
  id: "h",
  action: "claim_goal",
  label: "Go",
  status: "idle",
  ...over,
});

const stored = (over: Partial<StoredActionProposal> = {}): StoredActionProposal => ({
  id: "s",
  proposalId: "p1",
  label: "Do it",
  preview: "It changes things",
  risk: "STANDARD",
  status: "idle",
  ...over,
});

describe("hireProposal", () => {
  it("copies the payload the buddy sent and waits for an answer", () => {
    const event = {
      action: "place_note",
      label: "Note it",
      question: "q",
      taskId: "t",
      noteText: "n",
      cardIds: ["c1"],
      cardNames: ["C"],
      preview: "p",
    };

    const proposal = hireProposal("local", event);

    expect(proposal).toMatchObject({
      id: "local",
      action: "place_note",
      label: "Note it",
      question: "q",
      taskId: "t",
      noteText: "n",
      cardIds: ["c1"],
      cardNames: ["C"],
      preview: "p",
      status: "idle",
    });
  });

  it("carries nothing the buddy did not send", () => {
    const proposal = hireProposal("local", { action: "a", label: "l" });

    expect(proposal.question).toBeUndefined();
    expect(proposal.title).toBeUndefined();
  });
});

describe("storedProposal", () => {
  it("keeps the stored id, the preview and the risk, and waits for an answer", () => {
    const proposal = storedProposal("local", {
      proposalId: "p9",
      label: "Apply",
      preview: "words",
      risk: "BULK",
    } as never);

    expect(proposal).toEqual({
      id: "local",
      proposalId: "p9",
      label: "Apply",
      preview: "words",
      risk: "BULK",
      status: "idle",
    });
  });
});

describe("actionExtras", () => {
  it("sends the payload back and nothing about how the offer looked", () => {
    const extras = actionExtras(
      hire({ question: "q", taskId: "t", linkUrl: "u", cardIds: ["c"], label: "Go", preview: "p" }),
    );

    expect(extras).toMatchObject({ question: "q", taskId: "t", linkUrl: "u", cardIds: ["c"] });
    expect(extras).not.toHaveProperty("label");
    expect(extras).not.toHaveProperty("preview");
    expect(extras).not.toHaveProperty("status");
    expect(extras).not.toHaveProperty("action");
  });
});

describe("isStored", () => {
  it("tells a stored offer from a hire's", () => {
    expect(isStored(stored())).toBe(true);
    expect(isStored(hire())).toBe(false);
  });
});

describe("mayConfirm", () => {
  it.each(["idle", "error"] as const)("allows an offer that is %s", (status) => {
    expect(mayConfirm(hire({ status }))).toBe(true);
    expect(mayConfirm(stored({ status }))).toBe(true);
  });

  it("refuses an offer that is being confirmed, was dismissed, or went through", () => {
    expect(mayConfirm(hire({ status: "confirming" }))).toBe(false);
    expect(mayConfirm(hire({ status: "dismissed" }))).toBe(false);
    expect(mayConfirm(hire({ status: "resolved", ok: true }))).toBe(false);
  });

  it("lets a hire offer the backend refused be asked again", () => {
    expect(mayConfirm(hire({ status: "resolved", ok: false }))).toBe(true);
  });

  it("never lets a stored offer that resolved be confirmed twice", () => {
    expect(mayConfirm(stored({ status: "resolved", ok: false }))).toBe(false);
    expect(mayConfirm(stored({ status: "resolved", ok: true }))).toBe(false);
  });
});

describe("mayDismissStored", () => {
  it("allows an offer that is idle or failed to reach the server only", () => {
    expect(mayDismissStored(stored({ status: "idle" }))).toBe(true);
    expect(mayDismissStored(stored({ status: "error" }))).toBe(true);
    expect(mayDismissStored(stored({ status: "confirming" }))).toBe(false);
    expect(mayDismissStored(stored({ status: "resolved" }))).toBe(false);
    expect(mayDismissStored(stored({ status: "dismissed" }))).toBe(false);
  });
});

describe("what carrying an offer out changes", () => {
  const pathAction = BUDDY_PATH_ACTIONS[0];

  it("moves the path for a path action, and only a hire's", () => {
    expect(movesPath(hire({ action: pathAction }))).toBe(true);
    expect(movesPath(hire({ action: "something_else" }))).toBe(false);
    expect(movesPath(stored() as ProposedAction)).toBe(false);
  });

  it("touches the board for a board action, and only a hire's", () => {
    expect(touchesBoard(hire({ action: BUDDY_ACTION_PLACE_NOTE }))).toBe(true);
    expect(touchesBoard(hire({ action: "something_else" }))).toBe(false);
    expect(touchesBoard(stored())).toBe(false);
  });
});
