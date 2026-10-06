import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
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
