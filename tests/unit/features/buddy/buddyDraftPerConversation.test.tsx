import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuddyDraftProvider } from "../../../../src/features/buddy/BuddyDraftProvider";
import { BuddySessionContext } from "../../../../src/features/buddy/buddySessionContext";
import type { BuddySession } from "../../../../src/features/buddy/buddySessionContext";
import { useBuddyDraft } from "../../../../src/features/buddy/buddyDraftContext";
import { AuthContext } from "../../../../src/context/AuthContext";
import { createAuthValue, TEST_USER_ID } from "./buddyTestHarness";

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

function Harness({
  initial = null,
  team = null,
  userId = TEST_USER_ID,
}: {
  initial?: string | null;
  /** A team project the conversation is about; it takes the key over from the session id. */
  team?: string | null;
  userId?: string | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(initial);
  const session = useMemo(
    () =>
      ({
        submitMessage: vi.fn(),
        currentSessionId: sessionId,
        teamProjectId: team,
        isSessionBinned: () => false,
      }) as unknown as BuddySession,
    [sessionId, team],
  );

  return (
    <AuthContext.Provider value={createAuthValue(userId)}>
      <BuddySessionContext.Provider value={session}>
        <BuddyDraftProvider>
          <Box onGoTo={setSessionId} />
        </BuddyDraftProvider>
      </BuddySessionContext.Provider>
    </AuthContext.Provider>
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

  it("files a draft under the user who wrote it", async () => {
    const user = userEvent.setup();
    const first = render(<Harness initial="a" />);

    await user.type(box(), "mine");
    await user.click(goTo("go b"));
    first.unmount();

    expect(window.localStorage.getItem(`buddyDraft.${TEST_USER_ID}.a`)).toBe("mine");
    expect(window.localStorage.getItem("buddyDraft.a")).toBeNull();
  });

  it("does not hand one user's team draft to the next one on the same browser", async () => {
    const user = userEvent.setup();
    const first = render(<Harness team="project-1" userId="manager-1" />);

    await user.type(box(), "ask the team about the release");
    // Debounced: the words are written 400 ms after the last keystroke.
    await vi.waitFor(() =>
      expect(window.localStorage.getItem("buddyDraft.manager-1.team:project-1")).toBe(
        "ask the team about the release",
      ),
    );
    first.unmount();

    // The same project, a different person, the same browser.
    render(<Harness team="project-1" userId="manager-2" />);
    expect(box()).toHaveValue("");
  });

  it("does not carry the words in the box over to a person who signs in after", async () => {
    const user = userEvent.setup();
    const view = render(<Harness team="project-1" userId="manager-1" />);

    await user.type(box(), "still typing");
    view.rerender(<Harness team="project-1" userId="manager-2" />);

    expect(box()).toHaveValue("");
    // The first user's words were filed under them on the way out.
    expect(window.localStorage.getItem("buddyDraft.manager-1.team:project-1")).toBe("still typing");
  });

  it("keeps nothing for a visitor nobody is signed in as", async () => {
    const user = userEvent.setup();
    const first = render(<Harness initial="a" userId={null} />);

    await user.type(box(), "anonymous");
    await user.click(goTo("go b"));
    first.unmount();

    expect(window.localStorage.length).toBe(0);
  });

  it("drops the drafts that were filed before the user was part of the key", () => {
    window.localStorage.setItem("buddyDraft.__new__", "left by someone");
    window.localStorage.setItem("buddyDraft.team:project-1", "left by a manager");
    window.localStorage.setItem("buddyDraft.session-1", "an old one");
    window.localStorage.setItem(`buddyDraft.${TEST_USER_ID}.session-2`, "current");
    window.localStorage.setItem("somethingElse", "not ours");

    render(<Harness initial="session-2" />);

    expect(window.localStorage.getItem("buddyDraft.__new__")).toBeNull();
    expect(window.localStorage.getItem("buddyDraft.team:project-1")).toBeNull();
    expect(window.localStorage.getItem("buddyDraft.session-1")).toBeNull();
    expect(window.localStorage.getItem(`buddyDraft.${TEST_USER_ID}.session-2`)).toBe("current");
    expect(window.localStorage.getItem("somethingElse")).toBe("not ours");
  });
});
