import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddTaskToBoard } from "../../../../src/features/board/components/AddTaskToBoard";
import { readCardOrigins } from "../../../../src/features/board/layout/cardOrigins";
import { boardService } from "../../../../src/services/boardService";

let selectedProjectId = "p1";
vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../../../../src/context/useToast", () => ({ useToast: () => toast }));

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

  const press = () => userEvent.click(screen.getByRole("button", { name: /checklist/i }));

  /**
   * It does not say "add to my board", and that is the point. On the current-task card — which is
   * on the board by definition — an offer to add it there looked already done. What this makes is
   * the thing the task card cannot be.
   */
  it("says what it makes, not where it goes", () => {
    render(<AddTaskToBoard title="Fix the login redirect" />);

    expect(screen.getByRole("button", { name: "Break this into a checklist" })).toBeInTheDocument();
  });

  it("mints a checklist the hire owns", async () => {
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" summary={"- Reproduce it\n- Fix it"} />);

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
    render(<AddTaskToBoard title="Fix the login redirect" onAdded={onAdded} />);

    await press();

    await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
  });

  it("does not tell the board anything when the write failed", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    const onAdded = vi.fn();
    render(<AddTaskToBoard title="Fix the login redirect" onAdded={onAdded} />);

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
    render(<AddTaskToBoard title="Fix the login redirect" />);

    await press();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Break this into a checklist" })).toBeInTheDocument();
  });

  /** "Which task was this again" is what the working copy cannot answer on its own. */
  it("records the way back to the task", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" url="https://example.test/issues/7" />);

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
    render(<AddTaskToBoard title="Fix the login redirect" url={null} />);

    await press();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(readCardOrigins("p1")).toEqual({});
  });

  it("says so, and stays, when the board refuses", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    render(<AddTaskToBoard title="Fix the login redirect" />);

    await press();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /checklist/i })).toBeInTheDocument();
  });

  /** A hire on no project has no board, and an offer that can only fail is worse than none. */
  it("offers nothing when no project is selected", () => {
    selectedProjectId = "";
    render(<AddTaskToBoard title="Fix the login redirect" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
