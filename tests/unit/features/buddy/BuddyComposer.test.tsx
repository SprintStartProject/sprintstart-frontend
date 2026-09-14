import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BuddyComposer } from "../../../../src/features/buddy/components/BuddyComposer";

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
        <BuddyComposer
          draft={draft}
          setDraft={setDraft}
          handleSubmit={(event) => {
            event.preventDefault();
            onSend(draft);
            setDraft("");
          }}
        />
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
});
