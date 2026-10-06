import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { BuddyComposer } from "../../../../src/features/buddy/components/BuddyComposer";
import { BuddyDraftContext } from "../../../../src/features/buddy/buddyDraftContext";

/**
 * Hosts the composer with real `draft`/`setDraft` wiring.
 *
 * The walk is only observable through a controlled parent: the composer decides what the box
 * should now hold and hands it to the shared draft, so a `vi.fn()` in place of `setDraft`
 * would record the calls but never show the box changing.
 */
function Host({ history }: { history: string[] }) {
  const [draft, setDraft] = useState("");

  return (
    <BuddyDraftContext.Provider value={{ draft, setDraft, handleSubmit: () => false }}>
      <BuddyComposer promptHistory={history} />
    </BuddyDraftContext.Provider>
  );
}

const HISTORY = ["first question", "second question", "third question"];

function renderComposer(history: string[] = HISTORY) {
  render(<Host history={history} />);

  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
}

describe("BuddyComposer prompt history", () => {
  it("walks back through the questions, newest first", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}");
    expect(composer).toHaveValue("third question");

    await user.keyboard("{ArrowUp}");
    expect(composer).toHaveValue("second question");

    await user.keyboard("{ArrowUp}");
    expect(composer).toHaveValue("first question");
  });

  it("stays on the oldest rather than wrapping around", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");

    expect(composer).toHaveValue("first question");
  });

  it("walks forward again and ends on an empty box", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(composer).toHaveValue("first question");

    await user.keyboard("{ArrowDown}");
    expect(composer).toHaveValue("second question");

    await user.keyboard("{ArrowDown}");
    expect(composer).toHaveValue("third question");

    // Past the newest is where the hire writes something of their own again.
    await user.keyboard("{ArrowDown}");
    expect(composer).toHaveValue("");
  });

  it("returns to a blank box straight after stepping in and out", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}{ArrowDown}");

    expect(composer).toHaveValue("");
  });

  it("leaves the caret alone while there is a draft to edit", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();

    await user.click(composer);
    await user.keyboard("my own question{ArrowUp}");

    expect(composer).toHaveValue("my own question");
  });

  it("ends the walk once the recalled question is edited", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}");
    expect(composer).toHaveValue("third question");

    // Now it is the hire's text, not a recalled one, so arrow-up goes back to moving the caret.
    await user.keyboard("!{ArrowUp}");
    expect(composer).toHaveValue("third question!");
  });

  it("does nothing in a conversation with no questions yet", async () => {
    const user = userEvent.setup();
    const composer = renderComposer([]);
    composer.focus();

    await user.keyboard("{ArrowUp}{ArrowDown}");

    expect(composer).toHaveValue("");
  });

  it("puts the caret behind a recalled question", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}");

    expect(composer.selectionStart).toBe("third question".length);
  });
});
