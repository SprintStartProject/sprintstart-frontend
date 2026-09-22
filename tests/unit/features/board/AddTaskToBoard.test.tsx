import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddTaskToBoard } from "../../../../src/features/board/components/AddTaskToBoard";
import { readCardOrigins } from "../../../../src/features/board/layout/cardOrigins";
import { boardService } from "../../../../src/services/boardService";
import { openAiBuddy } from "../../../../src/features/buddy/aiBuddyBus";

let selectedProjectId = "p1";
vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../../../../src/context/useToast", () => ({ useToast: () => toast }));

vi.mock("../../../../src/features/buddy/aiBuddyBus", () => ({ openAiBuddy: vi.fn() }));

/**
 * The offer as a hire meets it on a task card. What the card's *lines* end up being is decided in
 * `taskChecklist.test.ts`; this is about what the button says, the request going out, and the trail
 * back being kept.
 */
describe("AddTaskToBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedProjectId = "p1";
    window.localStorage.clear();
  });

  /** A task that states its steps — the only kind that gets the checklist offer. */
  const STEPS = "- Reproduce it\n- Add a failing test";

  const press = () =>
    userEvent.click(screen.getByRole("button", { name: "Break this into a checklist" }));

  /**
   * It does not say "add to my board", and that is the point. On the current-task card — which is
   * on the board by definition — an offer to add it there looked already done. What this makes is
   * the thing the task card cannot be.
   */
  it("says what it makes, not where it goes", () => {
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} />);

    expect(screen.getByRole("button", { name: "Break this into a checklist" })).toBeInTheDocument();
  });

  it("mints a checklist the hire owns", async () => {
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} />);

    await press();

    await waitFor(() => expect(addCard).toHaveBeenCalledOnce());
    expect(addCard.mock.calls[0][0]).toBe("p1");
    expect(addCard.mock.calls[0][1]).toMatchObject({
      kind: "CHECKLIST",
      title: "Fix the login redirect",
    });
  });

  /**
   * The board is what the hire is looking at, and a card it has not re-read is a card that is on
   * the server and not on their screen. Without this the write lands silently.
   */
  it("tells the board to re-read itself once the card is really there", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    const onAdded = vi.fn();
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} onAdded={onAdded} />);

    await press();

    await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
  });

  it("does not tell the board anything when the write failed", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    const onAdded = vi.fn();
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} onAdded={onAdded} />);

    await press();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onAdded).not.toHaveBeenCalled();
  });

  /**
   * The card lands in front of them. A button still reading "on your board" beside the card it
   * made is a hint about something they can see, which reads as the button being stuck.
   */
  it("keeps saying the same thing after a save", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} />);

    await press();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Break this into a checklist" })).toBeInTheDocument();
  });

  /** "Which task was this again" is what the working copy cannot answer on its own. */
  it("records the way back to the task", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(
      <AddTaskToBoard
        title="Fix the login redirect"
        summary={STEPS}
        url="https://example.test/issues/7"
      />,
    );

    await press();

    await waitFor(() =>
      expect(readCardOrigins("p1").c1).toEqual({
        url: "https://example.test/issues/7",
        label: "Fix the login redirect",
      }),
    );
  });

  /** A dead trail is worse than none: a task with no page in the tracker gets no link. */
  it("records nothing when the task has no url", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} url={null} />);

    await press();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(readCardOrigins("p1")).toEqual({});
  });

  it("says so, and stays, when the board refuses", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} />);

    await press();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Break this into a checklist" })).toBeInTheDocument();
  });

  /** A hire on no project has no board, and an offer that can only fail is worse than none. */
  it("offers nothing when no project is selected", () => {
    selectedProjectId = "";
    render(<AddTaskToBoard title="Fix the login redirect" summary={STEPS} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  /**
   * The case that made the whole offer worth rethinking. A checklist of one item named after the
   * task is the title handed back with a checkbox beside it — no use to the hire it is for.
   */
  describe("a task that states no steps", () => {
    it("does not offer a checklist there is nothing to fill", () => {
      render(<AddTaskToBoard title="Fix the login redirect" summary="Some prose about the bug." />);

      expect(
        screen.queryByRole("button", { name: /break this into a checklist/i }),
      ).not.toBeInTheDocument();
    });

    /** The steps are the mentor's to write, in words the hire reads before they become a card. */
    it("asks the mentor for the first steps instead", async () => {
      render(<AddTaskToBoard title="Fix the login redirect" summary={null} />);

      await userEvent.click(screen.getByRole("button", { name: /ask for the first steps/i }));

      expect(openAiBuddy).toHaveBeenCalledTimes(1);
      const draft = vi.mocked(openAiBuddy).mock.calls[0][0]?.draft ?? "";
      expect(draft).toContain("Fix the login redirect");
      // A list, explicitly: the offer to keep a reply as a card only appears under one that holds
      // a list, so a question inviting prose would end the trail one step short.
      expect(draft).toContain("checklist of first steps");
    });

    /** Nothing lands on the board from here: the mentor has not said anything yet. */
    it("puts no card on the board", async () => {
      const addCard = vi.spyOn(boardService, "addCard");
      render(<AddTaskToBoard title="Fix the login redirect" summary={null} />);

      await userEvent.click(screen.getByRole("button", { name: /ask for the first steps/i }));

      expect(addCard).not.toHaveBeenCalled();
    });

    /** Silent where the card already asks the mentor that question in its own words. */
    it("offers nothing at all where the card already asks", () => {
      render(<AddTaskToBoard title="Fix the login redirect" summary={null} offerToAsk={false} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
