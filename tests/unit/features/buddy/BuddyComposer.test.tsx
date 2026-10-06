import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BuddyComposer } from "../../../../src/features/buddy/components/BuddyComposer";
import { BuddyDraftContext } from "../../../../src/features/buddy/buddyDraftContext";

/**
 * A question handed to the composer from outside has to be sendable with Enter.
 *
 * A suggestion chip (or "Ask your buddy about this step" with the dock already open) sets the draft
 * without touching the box, and focus stayed on the chip — so Enter clicked the chip again and
 * nothing was sent.
 */
describe("BuddyComposer", () => {
  function Harness({ onSend }: { onSend: (text: string) => void }) {
    const [draft, setDraft] = useState("");
    return (
      <>
        <button type="button" onClick={() => setDraft("Where am I on my path?")}>
          chip
        </button>
        <BuddyDraftContext.Provider
          value={{
            draft,
            setDraft,
            handleSubmit: (event) => {
              event.preventDefault();
              onSend(draft);
              setDraft("");
              return true;
            },
          }}
        >
          <BuddyComposer />
        </BuddyDraftContext.Provider>
      </>
    );
  }

  it("takes the caret when a chip fills it, so Enter sends the question", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);

    await user.click(screen.getByRole("button", { name: "chip" }));

    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("Where am I on my path?");
  });

  /**
   * The dock sends with the same session filters as the page, so it has to show them: a
   * narrowed search the hire cannot see is the one way a filter "loses" them knowledge. The
   * popover itself stays a page affair — 384 px has no room for it — so only the chips show.
   */
  it("shows the active filters in the compact dock too", () => {
    render(
      <BuddyDraftContext.Provider value={{ draft: "", setDraft: vi.fn(), handleSubmit: vi.fn() }}>
        <BuddyComposer
          compact
          filters={{ sourceSystems: ["GITHUB"], from: "", to: "" }}
          onFiltersChange={vi.fn()}
        />
      </BuddyDraftContext.Provider>,
    );

    expect(screen.getByText("Filtering:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove GitHub filter" })).toBeInTheDocument();
    expect(screen.queryByTestId("buddy-filters-toggle")).not.toBeInTheDocument();
  });
});
