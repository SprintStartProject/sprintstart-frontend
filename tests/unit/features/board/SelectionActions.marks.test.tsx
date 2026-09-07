import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SelectionActions } from "../../../../src/features/board/selection/SelectionActions";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1", canManageSelected: false }),
}));
vi.mock("../../../../src/context/useAuth", () => ({ useAuth: () => ({ profile: null }) }));
vi.mock("../../../../src/context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/** What the card's marks say about the words under the pointer, per test. */
let enclosingColor: string | null = null;

vi.mock("../../../../src/features/board/marks/useCardMarks", () => ({
  useCardMarks: () => ({
    canMark: true,
    colorAt: () => null,
    enclosingColorAt: () => enclosingColor,
    mark: vi.fn(),
    unmark: vi.fn(),
    marksFor: () => [],
    labels: {},
  }),
}));

/**
 * Selects the text of a `<p>` on a card, optionally wrapped in a link.
 *
 * The DOM is what the toolbar reads: the nearest `[data-card-id]` says the words are on a card the
 * board is already holding, and the nearest `<a>` says they are a link's own label.
 */
function selectOnCard(text: string, { inLink = false } = {}) {
  const card = document.createElement("section");
  card.setAttribute("data-card-id", "c1");

  const paragraph = document.createElement("p");
  const holder = inLink ? document.createElement("a") : paragraph;
  if (inLink) {
    holder.setAttribute("href", "https://example.com/runbook");
    paragraph.appendChild(holder);
  }
  holder.textContent = text;

  card.appendChild(paragraph);
  document.body.appendChild(card);

  const range = document.createRange();
  range.selectNodeContents(holder.firstChild!);
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

describe("what the selection toolbar offers on a card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enclosingColor = null;
    document.body.innerHTML = "";
    window.getSelection()?.removeAllRanges();
  });

  it("offers the marker pen on a card, and never a second copy of the card", async () => {
    renderToolbar();
    selectOnCard("deploys are on Thursdays");

    expect(await screen.findByRole("button", { name: "Highlight" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add to board/i })).not.toBeInTheDocument();
  });

  it("offers nothing inside a link on a card, rather than offering to keep it twice", async () => {
    renderToolbar();

    // The same words on the same card, first as prose and then as a link's own label, so the
    // difference this asserts is the anchor and nothing else.
    selectOnCard("the deployment runbook");
    await screen.findByRole("button", { name: "Highlight" });

    document.body.innerHTML = "";
    selectOnCard("the deployment runbook", { inLink: true });

    // A highlight has to be pressable to be recoloured or rubbed out, so the pen is not offered in
    // an anchor — and the words are still on a card the board is holding, so offering to save them
    // would make a second link card out of the one under the pointer.
    await waitFor(() => expect(screen.queryByRole("toolbar")).not.toBeInTheDocument());
  });

  it("still lets a highlight that reaches into a link be rubbed out", async () => {
    enclosingColor = "yellow";
    renderToolbar();
    selectOnCard("the deployment runbook", { inLink: true });

    expect(
      await screen.findByRole("button", { name: /remove the highlight|remove this highlight/i }),
    ).toBeInTheDocument();
  });
});
