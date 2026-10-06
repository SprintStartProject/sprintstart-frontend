import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { BuddyConversationList } from "../../../../src/features/buddy/components/BuddyConversationList";
import type { BuddySessionSummary } from "../../../../src/services/buddyService";
import { BuddyTestProviders, recordingToast } from "./buddyTestHarness";

/**
 * Binning is a confirmation, not a click: the trash opens a dialog that names the conversation
 * and spells out what happens, and only its confirm calls the session. What the session then
 * does with the row — remove it, move off it, refuse mid-turn — is `buddyBinning.test.tsx`;
 * this file is the control itself.
 */

const SESSIONS: BuddySessionSummary[] = [
  { id: "s2", title: "Release notes", projectId: null, createdAt: "2026-10-02T09:00:00.000Z" },
  { id: "s1", title: "", projectId: null, createdAt: "2026-10-01T09:00:00.000Z" },
];

function renderList(
  overrides: {
    onSelect?: (id: string) => void;
    onBin?: (id: string) => Promise<void>;
    disabled?: boolean;
    toast?: ReturnType<typeof recordingToast>;
  } = {},
) {
  const toast = overrides.toast ?? recordingToast();
  render(
    <BuddyTestProviders toastValue={toast.value}>
      <BuddyConversationList
        sessions={SESSIONS}
        currentSessionId="s2"
        disabled={overrides.disabled}
        onSelect={overrides.onSelect ?? vi.fn()}
        onBin={overrides.onBin ?? vi.fn().mockResolvedValue(undefined)}
      />
    </BuddyTestProviders>,
  );
  return toast;
}

describe("binning a conversation from the rail", () => {
  it("asks before anything happens, naming the conversation", async () => {
    const onBin = vi.fn().mockResolvedValue(undefined);
    renderList({ onBin });

    await userEvent.click(screen.getByTestId("buddy-bin-button-s2"));

    expect(screen.getByTestId("bin-conversation-modal")).toBeInTheDocument();
    expect(
      screen.getByText(
        /"Release notes" leaves your conversation list and is deleted for good after 7 days\./,
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("cancel-bin-conversation-btn"));
    expect(onBin).not.toHaveBeenCalled();
    expect(screen.queryByTestId("bin-conversation-modal")).not.toBeInTheDocument();
  });

  it("bins on confirm and says so", async () => {
    const onBin = vi.fn().mockResolvedValue(undefined);
    const toast = renderList({ onBin });

    await userEvent.click(screen.getByTestId("buddy-bin-button-s2"));
    await userEvent.click(screen.getByTestId("confirm-bin-conversation-btn"));

    expect(onBin).toHaveBeenCalledWith("s2");
    await waitFor(() =>
      expect(screen.queryByTestId("bin-conversation-modal")).not.toBeInTheDocument(),
    );
    expect(toast.shown).toEqual([{ variant: "success", message: "Conversation binned" }]);
  });

  it("keeps the dialog open and says why when the backend refuses", async () => {
    const onBin = vi.fn().mockRejectedValue(new Error("not found"));
    const toast = renderList({ onBin });

    await userEvent.click(screen.getByTestId("buddy-bin-button-s2"));
    await userEvent.click(screen.getByTestId("confirm-bin-conversation-btn"));

    await waitFor(() => expect(toast.shown).toHaveLength(1));
    expect(toast.shown[0].variant).toBe("error");
    // Still open, so the hire can try again without re-finding the row.
    expect(screen.getByTestId("bin-conversation-modal")).toBeInTheDocument();
  });

  it("stands the trash down while a turn is in flight", () => {
    renderList({ disabled: true });

    expect(screen.getByTestId("buddy-bin-button-s2")).toBeDisabled();
  });

  it("keeps an untitled conversation nameable in the dialog", async () => {
    renderList();

    await userEvent.click(screen.getByTestId("buddy-bin-button-s1"));

    expect(
      screen.getByText(
        /"New conversation" leaves your conversation list and is deleted for good after 7 days\./,
      ),
    ).toBeInTheDocument();
  });
});

/**
 * A list that only grows is a wall by the tenth conversation, so the rail groups rows by when
 * they started and filters them by title — client-side, over the hire's own list.
 */
describe("finding a conversation in the rail", () => {
  const NOW = new Date("2026-10-06T12:00:00");
  const daysAgo = (days: number) =>
    new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - days, 9).toISOString();

  const HISTORY: BuddySessionSummary[] = [
    { id: "t", title: "Deploy checklist", projectId: null, createdAt: daysAgo(0) },
    { id: "y", title: "Staging access", projectId: null, createdAt: daysAgo(1) },
    { id: "w", title: "Deploy rollback", projectId: null, createdAt: daysAgo(3) },
    { id: "o", title: "First week", projectId: null, createdAt: daysAgo(30) },
  ];

  function renderHistory() {
    render(
      <BuddyTestProviders>
        <BuddyConversationList
          sessions={HISTORY}
          currentSessionId="t"
          onSelect={vi.fn()}
          onBin={vi.fn().mockResolvedValue(undefined)}
        />
      </BuddyTestProviders>,
    );
  }

  /** The bucket label sitting right above a conversation's row. */
  function bucketOf(title: string): string | null {
    const group = screen.getByRole("button", { name: title }).closest("ul")?.parentElement;
    return group?.querySelector("p")?.textContent ?? null;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups the rows by when they started, newest bucket first", () => {
    renderHistory();

    expect(bucketOf("Deploy checklist")).toBe("Today");
    expect(bucketOf("Staging access")).toBe("Yesterday");
    expect(bucketOf("Deploy rollback")).toBe("This week");
    expect(bucketOf("First week")).toBe("Older");

    const labels = screen
      .getAllByText(/^(Today|Yesterday|This week|Older)$/)
      .map((node) => node.textContent);
    expect(labels).toEqual(["Today", "Yesterday", "This week", "Older"]);
  });

  it("filters by title, case-insensitively, and drops the buckets left empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderHistory();

    await user.type(screen.getByRole("textbox", { name: "Search conversations" }), "DEPLOY");

    expect(screen.getByRole("button", { name: "Deploy checklist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deploy rollback" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Staging access" })).not.toBeInTheDocument();
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
    expect(screen.queryByText("Older")).not.toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderHistory();

    await user.type(screen.getByRole("textbox", { name: "Search conversations" }), "payroll");

    expect(screen.getByText(/No conversations match/)).toHaveTextContent(
      "No conversations match “payroll”.",
    );
  });
});
