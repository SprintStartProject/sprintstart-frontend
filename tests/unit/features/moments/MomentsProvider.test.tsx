import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MomentsProvider } from "../../../../src/features/moments/MomentsProvider";
import { useMoments } from "../../../../src/features/moments/useMoments";
import type { AuthStatus } from "../../../../src/context/AuthContext";

/** Only the slice of the auth context that `MomentsProvider` actually reads. */
interface MockAuthValue {
  status: AuthStatus;
  profile: { firstName: string } | null;
}

const mockAuth = vi.hoisted(() => {
  const state: { value: MockAuthValue } = {
    value: { status: "authenticated", profile: { firstName: "Test" } },
  };
  return state;
});

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => mockAuth.value,
}));

/** Minimal consumer that triggers moments on demand. */
function Trigger() {
  const { celebrate, flyby, completeMission, revealPath, playLaunchSequence } = useMoments();
  return (
    <>
      <button onClick={playLaunchSequence}>launch</button>
      <button onClick={flyby}>fly</button>
      <button onClick={completeMission}>finish</button>
      <button onClick={() => revealPath()}>reveal</button>
      <button
        onClick={() =>
          celebrate({
            tone: "milestone",
            title: "Phase cleared",
            message: "The next phase is unlocked.",
            progress: { current: 2, total: 5 },
          })
        }
      >
        first
      </button>
      <button
        onClick={() =>
          celebrate({
            tone: "triumph",
            title: "All done",
            message: "Every phase is behind you.",
          })
        }
      >
        second
      </button>
    </>
  );
}

describe("MomentsProvider", () => {
  beforeEach(() => {
    mockAuth.value = {
      status: "authenticated",
      profile: { firstName: "Test" },
    };
  });

  it("throws when useMoments is used outside the provider", () => {
    // React logs the thrown error; silence it so the run stays readable.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/useMoments must be used within a MomentsProvider/);
    spy.mockRestore();
  });

  it("shows a queued celebration and dismisses it", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("first"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Phase cleared");
    expect(screen.getByText("The next phase is unlocked.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep going" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("queues celebrations instead of stacking them", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("first"));
    await user.click(screen.getByText("second"));

    // Only the first is on screen; the second waits its turn.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(await screen.findByText("Phase cleared")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep going" }));

    expect(await screen.findByText("All done")).toBeInTheDocument();
  });

  it("leaves boot to the splash instead of playing over it", () => {
    render(
      <MomentsProvider>
        <span>app</span>
      </MomentsProvider>,
    );

    // Keycloak's silent-SSO redirect used to black out a sequence started
    // here and then replay it from the top. The CSS splash in index.html
    // covers the load now; this must stay out of it.
    expect(screen.queryByText("SprintStart")).not.toBeInTheDocument();
    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("takes down the boot splash once auth resolves", async () => {
    const splash = document.createElement("div");
    splash.id = "boot-splash";
    document.body.appendChild(splash);

    mockAuth.value = { status: "loading", profile: null };
    const { rerender } = render(
      <MomentsProvider>
        <span>app</span>
      </MomentsProvider>,
    );

    // Still resolving: the splash is what the user is looking at.
    expect(document.getElementById("boot-splash")).toBeInTheDocument();

    mockAuth.value = {
      status: "authenticated",
      profile: { firstName: "Test" },
    };
    rerender(
      <MomentsProvider>
        <span>app</span>
      </MomentsProvider>,
    );

    // Fades, then is removed on a timer, so the exit is never cut off
    // halfway. Both are asynchronous: the fade itself waits for the launch
    // to finish playing before it starts.
    await waitFor(() => expect(splash).toHaveClass("is-ready"));
    await waitFor(() => expect(document.getElementById("boot-splash")).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it("plays the launch sequence on demand", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    expect(screen.queryByText("SprintStart")).not.toBeInTheDocument();

    await user.click(screen.getByText("launch"));

    expect(await screen.findByText("SprintStart")).toBeInTheDocument();
  });

  it("stays off the login screen", async () => {
    mockAuth.value = { status: "unauthenticated", profile: null };
    const user = userEvent.setup();

    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("launch"));

    expect(screen.queryByText("SprintStart")).not.toBeInTheDocument();
  });

  it("mounts the flyby and clears it again on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    expect(screen.queryByTestId("rocket-flyby")).not.toBeInTheDocument();

    await user.click(screen.getByText("fly"));
    expect(screen.getByTestId("rocket-flyby")).toBeInTheDocument();

    // Teardown is on a timer, not on the animation reporting itself done.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("rocket-flyby")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("ignores a second flyby while one is already in flight", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("fly"));
    await user.click(screen.getByText("fly"));

    expect(screen.getAllByTestId("rocket-flyby")).toHaveLength(1);
  });

  it("shows a progress ring on a celebration that carries one", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("first"));

    expect(await screen.findByRole("img", { name: "Phase 2 of 5 complete" })).toBeInTheDocument();
  });

  it("plays the mission-complete finale on demand", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("finish"));

    // The sequence opens on its first beat; the card arrives at the end, so
    // assert on the overlay being present rather than on its final copy.
    expect(await screen.findByText("Press any key to skip")).toBeInTheDocument();
  });

  it("plays the launch on demand", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("reveal"));

    // Opens waiting on the pad: the first input is the launch button, and
    // the prompt says so.
    expect(await screen.findByTestId("path-reveal")).toBeInTheDocument();
    expect(screen.getByText("Press any key to launch")).toBeInTheDocument();
  });

  it("waits on the pad for as long as it takes, then flies itself out once lit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("reveal"));
    expect(screen.getByTestId("path-reveal")).toBeInTheDocument();

    // No timer stands in for the user: someone who steps away comes back
    // to a rocket still waiting for them, however long that was.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Press any key to launch")).toBeInTheDocument();

    // Once lit, the remaining beats run themselves out — the launch ends by
    // handing over to the page, not by being dismissed. Advanced one beat
    // at a time: each stage only schedules the next once its own state
    // update has been flushed, so a single long jump would fire the first
    // timer and then find an empty queue.
    await user.keyboard("{Enter}");
    for (let beat = 0; beat < 4; beat++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(screen.queryByTestId("path-reveal")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("takes any input as a cue to get out of the way", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("reveal"));
    expect(await screen.findByTestId("path-reveal")).toBeInTheDocument();

    // First input is the launch itself...
    await user.keyboard("{Escape}");
    expect(screen.getByText("Press any key to skip")).toBeInTheDocument();

    // ...the second cuts to the hand-over, the third takes the rest.
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByTestId("path-reveal")).not.toBeInTheDocument());
  });

  it("ignores a second launch while one is already running", async () => {
    const user = userEvent.setup();
    render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("reveal"));
    await user.click(screen.getByText("reveal"));

    expect(screen.getAllByTestId("path-reveal")).toHaveLength(1);
  });

  it("stops the sequence if auth resolves to signed out mid-flight", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    await user.click(screen.getByText("launch"));
    expect(await screen.findByText("SprintStart")).toBeInTheDocument();

    mockAuth.value = { status: "unauthenticated", profile: null };
    rerender(
      <MomentsProvider>
        <Trigger />
      </MomentsProvider>,
    );

    expect(screen.queryByText("SprintStart")).not.toBeInTheDocument();
  });
});
