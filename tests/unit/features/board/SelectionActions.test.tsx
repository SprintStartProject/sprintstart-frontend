import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SelectionActions } from "../../../../src/features/board/selection/SelectionActions";
import { boardService } from "../../../../src/services/boardService";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

let selectedProjectId = "p1";
vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../../../../src/context/useToast", () => ({ useToast: () => toast }));

/**
 * The toolbar, at the level a hire meets it: highlight something, press the button, and find out
 * whether it landed. The decisions about *what* the card becomes are covered on their own in
 * `selectionCapture.test.ts`.
 */
describe("SelectionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedProjectId = "p1";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  function highlight(text: string) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    document.body.appendChild(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph.firstChild!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }

  function renderToolbar() {
    return render(
      <MemoryRouter>
        <SelectionActions />
      </MemoryRouter>,
    );
  }

  it("offers nothing until something is selected", () => {
    renderToolbar();

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("offers to keep a selection", async () => {
    renderToolbar();
    highlight("Run the migration first.");

    expect(await screen.findByRole("button", { name: /add to board/i })).toBeInTheDocument();
  });

  it("saves the selection to the selected project's board", async () => {
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({} as never);
    renderToolbar();
    highlight("Run the migration first.");

    await userEvent.click(await screen.findByRole("button", { name: /add to board/i }));

    await waitFor(() => expect(addCard).toHaveBeenCalledOnce());
    expect(addCard.mock.calls[0][0]).toBe("p1");
    expect(addCard.mock.calls[0][1]).toMatchObject({ kind: "NOTE" });
  });

  /**
   * Being pulled to the board to confirm something landed is the interruption this feature exists
   * to avoid. The toast carries the way there for whoever wants it.
   */
  it("confirms without navigating", async () => {
    vi.spyOn(boardService, "addCard").mockResolvedValue({} as never);
    renderToolbar();
    highlight("Run the migration first.");

    await userEvent.click(await screen.findByRole("button", { name: /add to board/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
    expect(toast.success.mock.calls[0][1]).toMatchObject({ action: { label: "View board" } });
  });

  it("keeps the offer up when saving fails", async () => {
    vi.spyOn(boardService, "addCard").mockRejectedValue(new Error("nope"));
    renderToolbar();
    highlight("Run the migration first.");

    await userEvent.click(await screen.findByRole("button", { name: /add to board/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /add to board/i })).toBeInTheDocument();
  });

  /** A hire on no project has no board, and an offer that can only fail is worse than none. */
  it("offers nothing when no project is selected", () => {
    selectedProjectId = "";
    renderToolbar();
    highlight("Run the migration first.");

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });
});
