import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GithubRepositorySyncSettings } from "../../../../../src/features/data-ingestion/components/GithubRepositorySyncSettings";
import type { GithubRepositoryConfig } from "../../../../../src/services/sources/githubService";

const UNSAVED = /you have unsaved changes/i;

function config(overrides: Partial<GithubRepositoryConfig> = {}): GithubRepositoryConfig {
  return {
    id: "cfg-1",
    repositoryOwner: "acme",
    repositoryName: "monorepo",
    autoUpdate: true,
    spec: { type: "INTERVAL", everyMinutes: 120 },
    schedule: "0 0/120 * * * *",
    nextSyncAt: null,
    ...overrides,
  };
}

describe("GithubRepositorySyncSettings", () => {
  it("clears the unsaved-changes hint after saving a weekly schedule", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    // Starts on INTERVAL 120, so the interval field holds a non-default value
    // that the weekly schedule never persists.
    const loadConfig = vi
      .fn()
      .mockResolvedValueOnce(config())
      .mockResolvedValue(
        config({ spec: { type: "WEEKLY", time: "02:00:00", daysOfWeek: ["MONDAY"] } }),
      );

    render(
      <GithubRepositorySyncSettings
        loadKey="acme/monorepo"
        loadConfig={loadConfig}
        onSave={onSave}
      />,
    );

    const weeklyTab = await screen.findByRole("button", { name: "Weekly" });
    expect(screen.queryByText(UNSAVED)).not.toBeInTheDocument();

    await user.click(weeklyTab);
    expect(screen.getByText(UNSAVED)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0]).toMatchObject({
      schedule: { type: "WEEKLY" },
    });

    // The reported bug: "Saved" appeared but the hint stuck around, because
    // the baseline fell back to the default interval while the form kept 120.
    await waitFor(() => {
      expect(screen.queryByText(UNSAVED)).not.toBeInTheDocument();
    });
  });

  it("does not report changes when only a field of another schedule type differs", async () => {
    const user = userEvent.setup();

    render(
      <GithubRepositorySyncSettings
        loadKey="acme/monorepo"
        loadConfig={vi
          .fn()
          .mockResolvedValue(
            config({ spec: { type: "WEEKLY", time: "02:00:00", daysOfWeek: ["MONDAY"] } }),
          )}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await screen.findByRole("button", { name: "Interval" });

    // Round-trip through INTERVAL (which rewrites the interval field) and back.
    await user.click(screen.getByRole("button", { name: "Interval" }));
    await user.click(screen.getByRole("button", { name: "Weekly" }));

    // Back at the saved weekly schedule, so nothing would change on save.
    await waitFor(() => {
      expect(screen.queryByText(UNSAVED)).not.toBeInTheDocument();
    });
  });

  it("still reports a genuine change to the active schedule", async () => {
    const user = userEvent.setup();

    render(
      <GithubRepositorySyncSettings
        loadKey="acme/monorepo"
        loadConfig={vi.fn().mockResolvedValue(config())}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const intervalInput = await screen.findByLabelText("Minutes");
    await user.clear(intervalInput);
    await user.type(intervalInput, "30");

    expect(screen.getByText(UNSAVED)).toBeInTheDocument();
  });
});
