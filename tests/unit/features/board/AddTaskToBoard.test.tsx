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
 * `taskChecklist.test.ts`; this is about the request going out and the trail back being kept.
 */
describe("AddTaskToBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedProjectId = "p1";
    window.localStorage.clear();
  });

  it("mints a checklist the hire owns", async () => {
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" summary="- Reproduce it\n- Fix it" />);

    await userEvent.click(screen.getByRole("button", { name: /add to my board/i }));

    await waitFor(() => expect(addCard).toHaveBeenCalledOnce());
    expect(addCard.mock.calls[0][0]).toBe("p1");
    expect(addCard.mock.calls[0][1]).toMatchObject({
      kind: "CHECKLIST",
      title: "Fix the login redirect",
    });
  });

  /** "Which task was this again" is what the working copy cannot answer on its own. */
  it("records the way back to the task", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "c1" } as never);
    render(<AddTaskToBoard title="Fix the login redirect" url="https://example.test/issues/7" />);

    await userEvent.click(screen.getByRole("button", { name: /add to my board/i }));

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

    await userEvent.click(screen.getByRole("button", { name: /add to my board/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(readCardOrigins("p1")).toEqual({});
  });

  it("says so, and stays, when the board refuses", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    render(<AddTaskToBoard title="Fix the login redirect" />);

    await userEvent.click(screen.getByRole("button", { name: /add to my board/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /add to my board/i })).toBeInTheDocument();
  });

  /** A hire on no project has no board, and an offer that can only fail is worse than none. */
  it("offers nothing when no project is selected", () => {
    selectedProjectId = "";
    render(<AddTaskToBoard title="Fix the login redirect" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
