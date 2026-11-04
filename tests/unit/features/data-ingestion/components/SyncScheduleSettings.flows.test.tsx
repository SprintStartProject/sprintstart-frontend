import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { SyncScheduleSettings } from "../../../../../src/features/data-ingestion/components/SyncScheduleSettings";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../../../../src/services/sources/syncSchedule";

const UNSAVED = /you have unsaved changes/i;

function loaded(over: Partial<SyncScheduleConfig> = {}): SyncScheduleConfig {
  return {
    autoUpdate: true,
    spec: { type: "INTERVAL", everyMinutes: 60 },
    nextSyncAt: null,
    ...over,
  };
}

function renderSettings(props: Partial<Parameters<typeof SyncScheduleSettings>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <ToastProvider>
      <SyncScheduleSettings onSave={onSave} {...props} />
    </ToastProvider>,
  );
  return { onSave };
}

describe("SyncScheduleSettings — notices and header", () => {
  it("shows the disclaimer", () => {
    renderSettings({ disclaimer: "Applies to every repository." });
    expect(screen.getByText("Applies to every repository.")).toBeInTheDocument();
  });

  it("shows the next sync, 'Not available' without one, and hides it on request", async () => {
    const loadConfig = vi.fn().mockResolvedValue(loaded());
    const { unmount } = render(
      <ToastProvider>
        <SyncScheduleSettings loadConfig={loadConfig} onSave={vi.fn()} />
      </ToastProvider>,
    );
    expect(await screen.findByText("Not available")).toBeInTheDocument();
    unmount();

    renderSettings({ showNextSync: false });
    expect(screen.queryByText("Next sync")).not.toBeInTheDocument();
  });

  it("shows a formatted next sync when the config has one", async () => {
    renderSettings({
      loadConfig: vi.fn().mockResolvedValue(loaded({ nextSyncAt: "2026-08-01T10:00:00Z" })),
    });
    await waitFor(() => expect(screen.queryByText("Not available")).not.toBeInTheDocument());
    expect(screen.getByText("Next sync")).toBeInTheDocument();
  });

  it("shows a load failure inline and leaves the form usable", async () => {
    renderSettings({ loadConfig: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Daily" })).toBeEnabled();
  });

  it("falls back to a generic message for a load failure that is not an Error", async () => {
    renderSettings({ loadConfig: vi.fn().mockRejectedValue("nope") });
    expect(await screen.findByText("Failed to load sync config")).toBeInTheDocument();
  });

  it("holds the controls while loading", async () => {
    let resolve: (config: SyncScheduleConfig) => void = () => {};
    renderSettings({
      loadConfig: () =>
        new Promise<SyncScheduleConfig>((r) => {
          resolve = r;
        }),
    });
    const toggle = await screen.findByRole("switch", { name: "Toggle auto update" });
    expect(toggle).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Daily" }).parentElement?.parentElement,
    ).toHaveAttribute("aria-disabled", "true");
    resolve(loaded());
    await waitFor(() => expect(toggle).toBeEnabled());
  });
});

describe("SyncScheduleSettings — auto update", () => {
  it("switches the explanation with the toggle and offers to save", async () => {
    const user = userEvent.setup();
    renderSettings({
      autoUpdateOnText: "On text",
      autoUpdateOffText: "Off text",
      toggleAriaLabel: "Auto toggle",
    });
    expect(screen.getByText("On text")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Auto toggle" }));
    expect(screen.getByText("Off text")).toBeInTheDocument();
    expect(screen.getByText(UNSAVED)).toBeInTheDocument();
  });
});

describe("SyncScheduleSettings — cadences", () => {
  it("starts on every 60 minutes and offers the curated minutes plus a stored odd one", async () => {
    renderSettings({
      loadConfig: vi
        .fn()
        .mockResolvedValue(loaded({ spec: { type: "INTERVAL", everyMinutes: 45 } })),
    });
    const select = await screen.findByLabelText("Every");
    await waitFor(() => expect(select).toHaveValue("45"));
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(values).toEqual(["5", "10", "15", "20", "30", "45", "60"]);
  });

  it("changes the interval and saves it", async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.selectOptions(screen.getByLabelText("Every"), "15");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        autoUpdate: true,
        schedule: { type: "INTERVAL", everyMinutes: 15 },
      } satisfies SyncScheduleRequest),
    );
  });

  it("saves a daily time", async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.click(screen.getByRole("button", { name: "Daily" }));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "05:30" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        autoUpdate: true,
        schedule: { type: "DAILY", time: "05:30:00" },
      }),
    );
  });

  it("toggles weekdays and saves them, refusing none", async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    const monday = screen.getByRole("button", { name: "Mon" });
    const friday = screen.getByRole("button", { name: "Fri" });
    expect(monday).toHaveAttribute("aria-pressed", "true");
    expect(friday).toHaveAttribute("aria-pressed", "false");

    await user.click(friday);
    expect(friday).toHaveAttribute("aria-pressed", "true");
    await user.click(monday);
    expect(monday).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        autoUpdate: true,
        schedule: { type: "WEEKLY", time: "02:00:00", daysOfWeek: ["FRIDAY"] },
      }),
    );
  });

  it("reports an invalid weekly schedule instead of saving it", async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Mon" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Select at least one weekday.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a monthly day and time", async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.click(screen.getByRole("button", { name: "Monthly" }));
    fireEvent.change(screen.getByLabelText("Day of month"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "04:00:00" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        autoUpdate: true,
        schedule: { type: "MONTHLY", time: "04:00:00", dayOfMonth: 15 },
      }),
    );
  });

  it("saves a custom cron and refuses a blank one", async () => {
    const user = userEvent.setup();
    const { onSave } = renderSettings();
    await user.click(screen.getByRole("button", { name: "Custom" }));
    const cron = screen.getByLabelText("Cron");
    expect(cron).toHaveValue("0 0 2 * * *");
    fireEvent.change(cron, { target: { value: "  " } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Cron expression is required.")).toBeInTheDocument();
    fireEvent.change(cron, { target: { value: "0 0 1 * * *" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        autoUpdate: true,
        schedule: { type: "CUSTOM", cron: "0 0 1 * * *" },
      }),
    );
  });

  it("shows only the fields of the selected cadence", async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(screen.queryByLabelText("Cron")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.queryByLabelText("Every")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cron")).toBeInTheDocument();
  });
});

describe("SyncScheduleSettings — saving", () => {
  it("confirms a save with a toast and clears the unsaved hint", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.selectOptions(screen.getByLabelText("Every"), "5");
    expect(screen.getByText(UNSAVED)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Sync settings saved")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(UNSAVED)).not.toBeInTheDocument());
  });

  it("uses the given save label", async () => {
    const user = userEvent.setup();
    renderSettings({ saveLabel: "Apply schedule" });
    await user.selectOptions(screen.getByLabelText("Every"), "5");
    expect(screen.getByRole("button", { name: "Apply schedule" })).toBeInTheDocument();
  });

  it("reports a failed save with its message and keeps the form dirty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("server said no"));
    renderSettings({ onSave });
    await user.selectOptions(screen.getByLabelText("Every"), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("server said no")).toBeInTheDocument();
    expect(screen.getByText(UNSAVED)).toBeInTheDocument();
  });

  it("falls back to a generic message for a failure that is not an Error", async () => {
    const user = userEvent.setup();
    renderSettings({ onSave: vi.fn().mockRejectedValue("x") });
    await user.selectOptions(screen.getByLabelText("Every"), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Couldn't save the sync settings.")).toBeInTheDocument();
  });

  it("re-reads the config after saving and shows the new next sync", async () => {
    const user = userEvent.setup();
    const loadConfig = vi
      .fn()
      .mockResolvedValueOnce(loaded())
      .mockResolvedValue(loaded({ nextSyncAt: "2026-08-01T10:00:00Z" }));
    renderSettings({ loadConfig });
    await screen.findByText("Not available");
    await user.selectOptions(screen.getByLabelText("Every"), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Not available")).not.toBeInTheDocument());
    expect(loadConfig).toHaveBeenCalledTimes(2);
  });

  it("does not reload when only the loader's identity changes", async () => {
    const first = vi.fn().mockResolvedValue(loaded());
    const second = vi.fn().mockResolvedValue(loaded());
    const { rerender } = render(
      <ToastProvider>
        <SyncScheduleSettings loadKey="a" loadConfig={first} onSave={vi.fn()} />
      </ToastProvider>,
    );
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    rerender(
      <ToastProvider>
        <SyncScheduleSettings loadKey="a" loadConfig={second} onSave={vi.fn()} />
      </ToastProvider>,
    );
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();

    rerender(
      <ToastProvider>
        <SyncScheduleSettings loadKey="b" loadConfig={second} onSave={vi.fn()} />
      </ToastProvider>,
    );
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
  });
});

describe("SyncScheduleSettings — initial config", () => {
  it("fills the form from an initial config and starts clean", async () => {
    renderSettings({
      initialConfig: {
        autoUpdate: false,
        schedule: { type: "WEEKLY", time: "06:00:00", daysOfWeek: ["SATURDAY"] },
      },
    });
    expect(await screen.findByRole("button", { name: "Sat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("switch", { name: "Toggle auto update" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByText(UNSAVED)).not.toBeInTheDocument();
  });

  it("prefers a loader over an initial config", async () => {
    const loadConfig = vi
      .fn()
      .mockResolvedValue(loaded({ spec: { type: "DAILY", time: "01:00:00" } }));
    renderSettings({
      loadConfig,
      initialConfig: { autoUpdate: true, schedule: { type: "CUSTOM", cron: "x" } },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Daily" })).toHaveClass(/./));
    expect(await screen.findByLabelText("Time")).toHaveValue("01:00:00");
    expect(screen.queryByLabelText("Cron")).not.toBeInTheDocument();
  });
});
