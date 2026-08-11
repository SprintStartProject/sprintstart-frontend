import { describe, it, expect } from "vitest";
import { deriveSourceStatus } from "../../../../src/features/data-ingestion/data";

describe("deriveSourceStatus", () => {
  it("marks a disabled source as disabled regardless of run state", () => {
    const status = deriveSourceStatus({
      backendStatus: "DISABLED",
      runStatus: "RUNNING",
      hasErrors: false,
      hasNeverSynced: false,
    });
    expect(status.state).toBe("disabled");
    expect(status.label).toBe("Disabled");
    expect(status.spinning).toBe(false);
  });

  it("treats backend UPDATING/INDEXING as syncing", () => {
    expect(
      deriveSourceStatus({ backendStatus: "UPDATING", hasErrors: false, hasNeverSynced: false })
        .state,
    ).toBe("syncing");
    expect(
      deriveSourceStatus({ backendStatus: "INDEXING", hasErrors: false, hasNeverSynced: false })
        .state,
    ).toBe("syncing");
  });

  it("treats a running ingestion run as syncing", () => {
    const status = deriveSourceStatus({
      runStatus: "RUNNING",
      hasErrors: false,
      hasNeverSynced: false,
    });
    expect(status.state).toBe("syncing");
    expect(status.spinning).toBe(true);
  });

  it("does not treat a stale pending AI index as syncing on its own", () => {
    // A finished run whose AI-index status never resolved must not read as busy.
    const status = deriveSourceStatus({
      aiSyncStatus: "PENDING",
      hasErrors: false,
      hasNeverSynced: false,
    });
    expect(status.state).toBe("connected");
  });

  it("labels backend INDEXING as Indexing", () => {
    const status = deriveSourceStatus({
      backendStatus: "INDEXING",
      hasErrors: false,
      hasNeverSynced: false,
    });
    expect(status.state).toBe("syncing");
    expect(status.label).toBe("Indexing");
  });

  it("flags a never-synced source as attention with a Not synced label", () => {
    const status = deriveSourceStatus({ hasErrors: false, hasNeverSynced: true });
    expect(status.state).toBe("attention");
    expect(status.label).toBe("Not synced");
  });

  it.each([{ runStatus: "FAILED" as const }, { runStatus: "PARTIAL" as const }])(
    "flags $runStatus runs as attention",
    ({ runStatus }) => {
      expect(deriveSourceStatus({ runStatus, hasErrors: false, hasNeverSynced: false }).state).toBe(
        "attention",
      );
    },
  );

  it("flags failed backend states and errors as attention", () => {
    expect(
      deriveSourceStatus({ backendStatus: "FAILED", hasErrors: false, hasNeverSynced: false })
        .state,
    ).toBe("attention");
    expect(deriveSourceStatus({ hasErrors: true, hasNeverSynced: false }).state).toBe("attention");
  });

  it("reports a source under a globally disabled connector as disabled", () => {
    const status = deriveSourceStatus({
      backendStatus: "CONNECTED",
      connectorEnabled: false,
      hasErrors: false,
      hasNeverSynced: false,
    });

    // The AI drops every chunk of a disabled connector, so "Connected"
    // would claim the source still feeds chat.
    expect(status.state).toBe("disabled");
    expect(status.label).toBe("Connector disabled");
  });

  it("treats an unknown connector state as enabled", () => {
    // HR may open the page but cannot read the connector endpoint — a
    // permission gap must not fake a disabled source.
    expect(
      deriveSourceStatus({
        backendStatus: "CONNECTED",
        connectorEnabled: undefined,
        hasErrors: false,
        hasNeverSynced: false,
      }).state,
    ).toBe("connected");
  });

  it("keeps the source-level label when the source itself is disabled too", () => {
    expect(
      deriveSourceStatus({
        backendStatus: "DISABLED",
        connectorEnabled: false,
        hasErrors: false,
        hasNeverSynced: false,
      }).label,
    ).toBe("Disabled");
  });

  it("treats an out-of-date source as stale, not as a failure", () => {
    const status = deriveSourceStatus({
      backendStatus: "OUT_OF_DATE",
      hasErrors: false,
      hasNeverSynced: false,
    });

    // With auto-update off this is the expected state between syncs, so it
    // must not read as red "needs attention".
    expect(status.state).toBe("stale");
    expect(status.label).toBe("Out of date");
    expect(status.tone).toBe("warning");
  });

  it("still reports a failing out-of-date source as attention", () => {
    expect(
      deriveSourceStatus({
        backendStatus: "OUT_OF_DATE",
        hasErrors: true,
        hasNeverSynced: false,
      }).state,
    ).toBe("attention");
  });

  it("returns connected when everything is up to date", () => {
    const status = deriveSourceStatus({
      backendStatus: "CONNECTED",
      runStatus: "COMPLETED",
      aiSyncStatus: "SUCCEEDED",
      hasErrors: false,
      hasNeverSynced: false,
    });
    expect(status.state).toBe("connected");
    expect(status.label).toBe("Connected");
  });
});
