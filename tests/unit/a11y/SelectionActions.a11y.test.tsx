import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SelectionActions } from "../../../src/features/board/selection/SelectionActions";

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

// The toolbar asks who is looking, because a manager is offered one extra action. Mocked as a hire:
// what this file is about is that the toolbar every hire meets is reachable and named.

/**
 * A toolbar that appears from a mouse gesture is the easiest kind to leave unreachable, so the
 * point here is not only that it has no violations but that it is in the tab order with a name.
 */
describe("SelectionActions accessibility", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
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

  it("has no accessibility violations while offering an action", async () => {
    const { container } = render(
      <MemoryRouter>
        <SelectionActions />
      </MemoryRouter>,
    );
    highlight("Run the migration first.");
    await screen.findByRole("toolbar");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("names the toolbar and its action", async () => {
    render(
      <MemoryRouter>
        <SelectionActions />
      </MemoryRouter>,
    );
    highlight("Run the migration first.");

    expect(await screen.findByRole("toolbar", { name: /selected text/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to board/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask the buddy/i })).toBeInTheDocument();
  });

  /** Selection is not a mouse-only gesture — shift-arrow makes one too, and must be actionable. */
  it("is reachable by keyboard", async () => {
    render(
      <MemoryRouter>
        <SelectionActions />
      </MemoryRouter>,
    );
    highlight("Run the migration first.");

    const button = await screen.findByRole("button", { name: /add to board/i });
    button.focus();

    expect(button).toHaveFocus();
  });

  /**
   * Both offers, not just the first. A hire who selected something with shift-arrow because a
   * pointer is not how they work is the hire most likely to be asking what it means.
   */
  it("puts both actions in the tab order", async () => {
    render(
      <MemoryRouter>
        <SelectionActions />
      </MemoryRouter>,
    );
    highlight("Run the migration first.");

    const ask = await screen.findByRole("button", { name: /ask the buddy/i });
    ask.focus();

    expect(ask).toHaveFocus();
  });
});
