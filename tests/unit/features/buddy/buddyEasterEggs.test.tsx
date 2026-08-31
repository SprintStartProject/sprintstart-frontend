import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";

/**
 * A greeting that opens the visit and writes nothing — same stub as
 * `useBuddy.test.tsx`: an unhandled greeting request would be a failed
 * greeting and put a turn in front of everything these tests index into.
 */
function silentGreeting() {
  const encoder = new TextEncoder();
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\\n\\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("buddy easter eggs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
  });

  /** Mounts the session with a silent greeting and waits for it to settle. */
  async function mountConversation() {
    server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));
    server.use(
      http.post("/api/v1/onboarding/me/buddy/visit", () => new HttpResponse(null, { status: 204 })),
    );

    const harness = renderHook(() => useBuddy(), { wrapper: BuddyProvider });
    await waitFor(() => {
      expect(harness.result.current.messages).toHaveLength(0);
    });
    return harness;
  }

  it("exposes the dino waiting-game state from the shared hook", async () => {
    const { result } = await mountConversation();

    // Locked by default: no game state leaks out as active.
    expect(result.current.dinoUnlocked).toBe(false);
    expect(result.current.dinoGameActive).toBe(false);

    // Unlocking (as the Settings cogwheel does) arms the trigger.
    act(() => {
      window.localStorage.setItem("dinoUnlocked", "true");
      window.dispatchEvent(new Event("dinoUnlockChanged"));
    });
    expect(result.current.dinoUnlocked).toBe(true);
  });

  it("swallows egg phrases silently instead of sending them to the buddy", async () => {
    const { result } = await mountConversation();

    const sendSpy = vi.spyOn(result.current, "sendMessage");
    let messagePosted = false;
    server.use(
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        messagePosted = true;
        return silentGreeting();
      }),
    );

    act(() => {
      result.current.setDraft("Do a barrel roll");
    });
    act(() => {
      result.current.handleSubmit(new Event("submit") as unknown as React.FormEvent);
    });

    // The draft is cleared, nothing is sent, and no reply arrives.
    expect(result.current.draft).toBe("");
    expect(sendSpy).not.toHaveBeenCalled();
    expect(messagePosted).toBe(false);

    // A normal word goes through the normal path.
    act(() => {
      result.current.setDraft("what is my next step?");
    });
    act(() => {
      result.current.handleSubmit(new Event("submit") as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(messagePosted).toBe(true);
    });
  });
});
