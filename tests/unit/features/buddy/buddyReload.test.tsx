import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

/**
 * What a conversation read carries back into the view: the backend's own message ids (what a
 * later delete names — see the message-deletion endpoint), the sources a reply was grounded
 * in, and the cut-short flag. A read that arrives without them loses all three from the
 * thread even though the backend has them — which is what happened before this slice.
 */
describe("a conversation read back from history", () => {
  it("keeps the backend's ids and the fields the read carries", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () =>
        HttpResponse.json([
          {
            id: "m-1",
            role: "USER",
            content: "where do I start?",
            createdAt: "2026-10-01T09:00:00.000Z",
          },
          {
            id: "m-2",
            role: "ASSISTANT",
            content: "The setup lives in the readme [1].",
            createdAt: "2026-10-01T09:00:01.000Z",
            isIncomplete: true,
            citations: [
              {
                id: "c-1",
                artifactId: "a1",
                filename: "README.md",
                sourceUrl: null,
                startLine: 12,
                startPage: null,
              },
            ],
          },
        ]),
      ),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    const reply = result.current.messages[1];
    expect(reply.id).toBe("m-2");
    expect(reply.isIncomplete).toBe(true);
    expect(reply.citations).toHaveLength(1);
    expect(reply.citations?.[0].filename).toBe("README.md");
  });
});
