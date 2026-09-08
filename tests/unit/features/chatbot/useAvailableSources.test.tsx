import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAvailableSources } from "../../../../src/features/chatbot/hooks/useAvailableSources";

const { mockListConnectors } = vi.hoisted(() => ({ mockListConnectors: vi.fn() }));

vi.mock("../../../../src/services/connectorService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/connectorService")>();
  return {
    ...actual,
    connectorService: { ...actual.connectorService, listConnectors: mockListConnectors },
  };
});

function connector(id: string, enabled = true) {
  return {
    id,
    name: `${id} connector`,
    enabled,
    firstConfiguredAt: null,
    lastConfiguredAt: null,
  };
}

describe("useAvailableSources", () => {
  it("offers every enabled connector the chat can filter by, uploads included", async () => {
    mockListConnectors.mockResolvedValue([
      connector("github"),
      connector("jira"),
      connector("confluence"),
    ]);

    const { result } = renderHook(() => useAvailableSources());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect([...result.current.sources].sort()).toEqual(["CONFLUENCE", "GITHUB", "JIRA", "UPLOAD"]);
  });

  it("leaves out a disabled connector and any id the chat has no filter for", async () => {
    mockListConnectors.mockResolvedValue([
      connector("github"),
      connector("confluence", false),
      connector("sonarqube"),
    ]);

    const { result } = renderHook(() => useAvailableSources());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect([...result.current.sources].sort()).toEqual(["GITHUB", "UPLOAD"]);
  });
});
