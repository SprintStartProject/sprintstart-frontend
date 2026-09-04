import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBuddySuggestions } from "../../../../src/features/buddy/hooks/useBuddySuggestions";

vi.mock("../../../../src/services/buddyService", () => ({
  getSuggestions: vi.fn(),
}));

import { getSuggestions } from "../../../../src/services/buddyService";

describe("useBuddySuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSuggestions).mockResolvedValue([
      { label: "What should I work on?", question: "What should I work on next?" },
    ]);
  });

  it("reads the hire’s chips from the backend", async () => {
    const { result } = renderHook(() => useBuddySuggestions());

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].label).toBe("What should I work on?");
  });

  /** The widget defers this until the panel is first opened, exactly as it defers the history —
   *  an unopened widget makes no request. */
  it("asks for nothing while the surface is not showing", () => {
    renderHook(() => useBuddySuggestions(false));

    expect(getSuggestions).not.toHaveBeenCalled();
  });

  /**
   * A chip row is an invitation, not information. A hire who cannot be offered suggestions
   * sees a composer that still works — an error about a failed suggestion fetch would be noise
   * about something they never asked for.
   */
  it("shows no chips and no error when the call fails", async () => {
    vi.mocked(getSuggestions).mockRejectedValue(new Error("offline"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useBuddySuggestions());

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(result.current).toEqual([]);

    consoleError.mockRestore();
  });
});
