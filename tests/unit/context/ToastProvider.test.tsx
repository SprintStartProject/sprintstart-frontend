import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { useToast } from "../../../src/context/useToast";

/**
 * A tiny console wired to the toast API, so tests can drive the real provider
 * the way a page would — through the hook — instead of poking at internals.
 * The "quick" and "sticky" buttons pin explicit durations so the auto-dismiss
 * behaviour can be exercised on real timers without a multi-second wait.
 */
function ToastHarness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Saved")}>success</button>
      <button onClick={() => toast.error("Boom", { description: "HTTP 500" })}>error</button>
      <button onClick={() => toast.info("Deleted", { action: { label: "Undo", onClick: onUndo } })}>
        undoable
      </button>
      <button onClick={() => toast.success("Blip", { duration: 80 })}>quick</button>
      <button onClick={() => toast.info("Pinned", { duration: Infinity })}>sticky</button>
    </div>
  );
}

const onUndo = vi.fn();

function renderHarness() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

/** The toast stack is an aria-labelled ordered list. */
function stack() {
  return screen.getByRole("list", { name: "Notifications" });
}

describe("ToastProvider", () => {
  beforeEach(() => {
    onUndo.mockClear();
  });

  it("shows a toast with its message when a helper is called", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "success" }));

    expect(within(stack()).getByText("Saved")).toBeInTheDocument();
  });

  it("renders the description line and an assertive role for errors", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "error" }));

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Boom")).toBeInTheDocument();
    expect(within(alert).getByText("HTTP 500")).toBeInTheDocument();
  });

  it("removes a toast when its close button is pressed", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(screen.queryByText("Saved")).not.toBeInTheDocument());
  });

  it("runs the action callback and dismisses when Undo is pressed", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "undoable" }));
    await user.click(screen.getByRole("button", { name: /Undo/ }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Deleted")).not.toBeInTheDocument());
  });

  it("caps the stack at four toasts, dropping the oldest", async () => {
    const user = userEvent.setup();
    renderHarness();

    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByRole("button", { name: "success" }));
    }

    expect(within(stack()).getAllByText("Saved")).toHaveLength(4);
  });

  it("auto-dismisses after the given duration elapses", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "quick" }));
    expect(screen.getByText("Blip")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText("Blip")).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it("keeps a sticky (Infinity duration) toast up while time passes", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "sticky" }));

    // Well past any finite default; a sticky toast must still be there.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });
});
