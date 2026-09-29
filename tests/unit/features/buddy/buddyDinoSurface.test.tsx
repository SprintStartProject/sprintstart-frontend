import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ProjectSelectionSlice } from "../../../../src/features/buddy/hooks/useBuddyConversation.ts";
import { useBuddyConversation } from "../../../../src/features/buddy/hooks/useBuddyConversation.ts";
import { AuthContext, type AuthContextType } from "../../../../src/context/AuthContext.ts";
import type { UserProfile } from "../../../../src/services/types.ts";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup.ts";

/**
 * The dino waiting-game in the buddy session. The session lives app-wide, so the game may
 * only open while a surface that shows the thread is on screen, and must close when that
 * surface goes away or the conversation it belongs to is swapped out.
 */

const authValue: AuthContextType = {
  status: "authenticated",
  profile: { id: "user-1" } as unknown as UserProfile,
  login: async () => {},
  logout: async () => {},
  refetchProfile: async () => {},
};

const authWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
);

function sel(selectedProjectId: string, canManageSelected: boolean): ProjectSelectionSlice {
  return {
    selectedProjectId,
    hasSelectedProject: selectedProjectId !== "",
    canManageSelected,
    isLoading: false,
    setSelectedProjectId: vi.fn(),
  };
}

const encoder = new TextEncoder();

function doneStream() {
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

/** Replies stay open until `finishReply` is called, so the buddy keeps "thinking". */
let finishReply: () => void = () => {};

function pressSpace() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true }));
  });
}

async function mount() {
  const hook = renderHook(
    ({ selection }: { selection: ProjectSelectionSlice }) => useBuddyConversation(selection),
    { initialProps: { selection: sel("", false) }, wrapper: authWrapper },
  );
  await act(async () => {
    await hook.result.current.ensureOpened();
  });
  return hook;
}

async function startTurn(result: { current: ReturnType<typeof useBuddyConversation> }) {
  act(() => {
    void result.current.sendMessage("How do I start?");
  });
  await waitFor(() => expect(result.current.isThinking).toBe(true));
}

describe("buddy dino waiting-game surfaces", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("dinoUnlocked", "true");
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => doneStream()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
        finishReply = () => {
          ctrl?.enqueue(encoder.encode('data: {"type":"token","content":"Hi"}\n\n'));
          ctrl?.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          ctrl?.close();
          ctrl = null;
        };
        return new HttpResponse(
          new ReadableStream<Uint8Array>({
            start(controller) {
              ctrl = controller;
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }),
    );
  });

  afterEach(() => {
    finishReply();
    vi.restoreAllMocks();
  });

  it("does not open the game while no surface shows the thread (minimised dock)", async () => {
    const { result, unmount } = await mount();
    await startTurn(result);

    pressSpace();
    expect(result.current.dinoGameActive).toBe(false);
    unmount();
  });

  it("opens on a visible surface and closes when that surface goes away", async () => {
    const { result, unmount } = await mount();
    let release: () => void = () => {};
    act(() => {
      release = result.current.registerDinoSurface();
    });
    await startTurn(result);

    pressSpace();
    expect(result.current.dinoGameActive).toBe(true);

    // The dock is minimised mid-game: the game must not keep running behind it.
    act(() => release());
    expect(result.current.dinoGameActive).toBe(false);
    unmount();
  });

  it("closes the game when the conversation is switched", async () => {
    const { result, rerender, unmount } = await mount();
    act(() => {
      result.current.registerDinoSurface();
    });
    await startTurn(result);
    pressSpace();
    expect(result.current.dinoGameActive).toBe(true);

    // The reply lands; the game outlives the turn (keepActiveUntilExit)…
    act(() => {
      finishReply();
    });
    await waitFor(() =>
      expect(result.current.isStreaming || result.current.isThinking).toBe(false),
    );
    expect(result.current.dinoGameActive).toBe(true);

    // …until the thread it was reporting on is swapped for the team conversation.
    act(() => {
      result.current.switchTeamProject("p1");
      rerender({ selection: sel("p1", true) });
    });
    await waitFor(() => expect(result.current.teamProjectId).toBe("p1"));
    expect(result.current.dinoGameActive).toBe(false);
    unmount();
  });
});
