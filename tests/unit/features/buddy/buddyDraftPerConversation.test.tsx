import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuddyDraftProvider } from "../../../../src/features/buddy/BuddyDraftProvider";
import { BuddySessionContext } from "../../../../src/features/buddy/buddySessionContext";
import type { BuddySession } from "../../../../src/features/buddy/buddySessionContext";
import { useBuddyDraft } from "../../../../src/features/buddy/buddyDraftContext";

/** The composer's half, reduced to what the draft behaviour needs: the box, a switch, a send. */
function Box({ onGoTo }: { onGoTo: (id: string) => void }) {
  const { draft, setDraft, handleSubmit } = useBuddyDraft();

  return (
    <>
      <textarea aria-label="box" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" onClick={() => onGoTo("a")}>
        go a
      </button>
      <button type="button" onClick={() => onGoTo("b")}>
        go b
      </button>
      <button
        type="button"
        onClick={() =>
          handleSubmit({ preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>)
        }
      >
        send
      </button>
    </>
  );
}

function Harness({ initial = null }: { initial?: string | null }) {
  const [sessionId, setSessionId] = useState<string | null>(initial);
  const session = useMemo(
    () =>
      ({
        submitMessage: vi.fn(),
        currentSessionId: sessionId,
        teamProjectId: null,
      }) as unknown as BuddySession,
    [sessionId],
  );

  return (
    <BuddySessionContext.Provider value={session}>
      <BuddyDraftProvider>
        <Box onGoTo={setSessionId} />
      </BuddyDraftProvider>
    </BuddySessionContext.Provider>
  );
}

const box = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "box" });
const goTo = (name: string) => screen.getByRole("button", { name });

describe("the composer's draft, per conversation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("files each conversation's words with it, and the first open adopts what was typed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Typed before the first open resolved a conversation — the words belong to whatever
    // conversation appears.
    await user.type(box(), "who approves deploys");
    await user.click(goTo("go a"));
    expect(box()).toHaveValue("who approves deploys");

    // A second conversation starts with an empty box...
    await user.click(goTo("go b"));
    expect(box()).toHaveValue("");
    await user.type(box(), "for b");

    // ...and each conversation's words come back with it.
    await user.click(goTo("go a"));
    expect(box()).toHaveValue("who approves deploys");
    await user.click(goTo("go b"));
    expect(box()).toHaveValue("for b");
  });

  it("survives a reload", async () => {
    const user = userEvent.setup();
    const first = render(<Harness initial="a" />);

    await user.type(box(), "half a question");
    // Switching away files it under the conversation it was written for.
    await user.click(goTo("go b"));
    first.unmount();

    render(<Harness initial="a" />);
    expect(box()).toHaveValue("half a question");
  });

  it("does not resurrect a question that was sent", async () => {
    const user = userEvent.setup();
    const first = render(<Harness initial="a" />);

    await user.type(box(), "asked and sent");
    await user.click(goTo("send"));
    expect(box()).toHaveValue("");

    first.unmount();
    render(<Harness initial="a" />);
    expect(box()).toHaveValue("");
  });
});
