import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChatComposer } from "../../../../../src/features/chatbot/components/ChatComposer";

/**
 * Hosts the composer with real `value`/`onChange` wiring.
 *
 * The walk is only observable through a controlled parent: the component decides what the
 * composer should now hold and hands it up, so a `vi.fn()` in place of `onChange` would record
 * the calls but never show the composer changing.
 */
function Host({ history }: { history: string[] }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSubmit={(event) => event.preventDefault()}
      onStop={vi.fn()}
      isBusy={false}
      hasProject
      promptHistory={history}
      availableSources={[]}
      sourcesLoading={false}
      textareaRef={textareaRef}
      showFilters={false}
      onToggleFilters={vi.fn()}
      from=""
      setFrom={vi.fn()}
      to=""
      setTo={vi.fn()}
      sourceSystems={[]}
      toggleSourceSystem={vi.fn()}
      activeFilterCount={0}
      clearFilters={vi.fn()}
    />
  );
}

const HISTORY = ["first question", "second question", "third question"];

function renderComposer(history: string[] = HISTORY) {
  render(<Host history={history} />);

  return screen.getByTestId<HTMLTextAreaElement>("chat-input");
}

describe("ChatComposer prompt history", () => {
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

  it("walks forward again and ends on an empty composer", async () => {
    const user = userEvent.setup();
    const composer = renderComposer();
    composer.focus();

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(composer).toHaveValue("first question");

    await user.keyboard("{ArrowDown}");
    expect(composer).toHaveValue("second question");

    await user.keyboard("{ArrowDown}");
    expect(composer).toHaveValue("third question");

    // Past the newest is where you write something of your own again.
    await user.keyboard("{ArrowDown}");
    expect(composer).toHaveValue("");
  });

  it("returns to a blank composer straight after stepping in and out", async () => {
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

    // Now it is the user's text, not a recalled one, so arrow-up goes back to moving the caret.
    await user.keyboard("!{ArrowUp}");
    expect(composer).toHaveValue("third question!");
  });

  it("does nothing in a chat with no questions yet", async () => {
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
