import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePathRevealMoment } from "../../../../src/features/onboarding/hooks/usePathRevealMoment";
import type {
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  StepStatus,
} from "../../../../src/features/onboarding/types";

const mockRevealPath = vi.hoisted(() => vi.fn<(handlers?: { onLaunched?: () => void }) => void>());

vi.mock("../../../../src/features/moments", () => ({
  useMoments: () => ({
    celebrate: vi.fn(),
    flyby: vi.fn(),
    completeMission: vi.fn(),
    revealPath: mockRevealPath,
    playLaunchSequence: vi.fn(),
    isLaunching: false,
  }),
}));

function step(
  id: string,
  status: StepStatus = "WAITING",
  startedAt: string | null = null,
): OnboardingStepEndpoint {
  return {
    id,
    phaseId: "phase1",
    position: 1,
    title: id,
    description: "",
    type: "TASK",
    estimatedMinutes: 10,
    expectedOutcomes: [],
    tasks: [],
    resources: [],
    status,
    startedAt,
    completedAt: null,
    feedback: null,
    skip: null,
  };
}

/** A freshly generated, completely untouched path. */
function freshPath(
  id = "path1",
  steps: OnboardingStepEndpoint[] = [step("step1"), step("step2")],
): OnboardingPathEndpoint {
  return {
    id,
    userId: "user1",
    createdAt: new Date().toISOString(),
    phases: [
      {
        id: "phase1",
        pathId: id,
        position: 1,
        title: "Find your feet",
        description: "",
        locked: false,
        unlockReason: null,
        checkSummary: {
          required: true,
          questionCount: 3,
          passed: false,
          latestAttemptId: null,
          latestAttemptAt: null,
        },
        steps,
      },
    ],
  };
}

function Harness({ path }: { path: OnboardingPathEndpoint | null }) {
  usePathRevealMoment(path);
  return <span>onboarding</span>;
}

describe("usePathRevealMoment", () => {
  beforeEach(() => {
    mockRevealPath.mockClear();
    window.localStorage.clear();
  });

  /** Stands in for the user pressing a key to set the rocket off. */
  function fireLaunch() {
    const handlers = mockRevealPath.mock.calls.at(-1)?.[0];
    handlers?.onLaunched?.();
  }

  it("reveals a freshly generated path the first time it is shown", () => {
    render(<Harness path={freshPath()} />);

    expect(mockRevealPath).toHaveBeenCalledTimes(1);
  });

  it("does not reveal while the page has no path yet", () => {
    render(<Harness path={null} />);

    expect(mockRevealPath).not.toHaveBeenCalled();
  });

  it("never reveals the same path twice once the user has launched it", () => {
    const { unmount } = render(<Harness path={freshPath()} />);
    expect(mockRevealPath).toHaveBeenCalledTimes(1);
    fireLaunch();
    unmount();

    // A fresh mount stands in for the next visit: only localStorage carries
    // over, which is exactly what has to keep the launch from replaying.
    mockRevealPath.mockClear();
    render(<Harness path={freshPath()} />);

    expect(mockRevealPath).not.toHaveBeenCalled();
  });

  it("offers it again on the next visit when it was never launched", () => {
    const { unmount } = render(<Harness path={freshPath()} />);
    expect(mockRevealPath).toHaveBeenCalledTimes(1);

    // Clicked through to another page without setting the rocket off. A
    // launch nobody fired is not one they have had, so coming back has to
    // find it still on the pad.
    unmount();

    mockRevealPath.mockClear();
    const { unmount: unmountSecond } = render(<Harness path={freshPath()} />);
    expect(mockRevealPath).toHaveBeenCalledTimes(1);

    // And it is still only spent by launching, however many visits later.
    fireLaunch();
    unmountSecond();

    mockRevealPath.mockClear();
    render(<Harness path={freshPath()} />);
    expect(mockRevealPath).not.toHaveBeenCalled();
  });

  it("reveals again once a new path is generated", () => {
    const { unmount } = render(<Harness path={freshPath("path1")} />);
    fireLaunch();
    unmount();

    mockRevealPath.mockClear();
    render(<Harness path={freshPath("path2")} />);

    expect(mockRevealPath).toHaveBeenCalledTimes(1);
  });

  it("re-renders with the same path without replaying", () => {
    const path = freshPath();
    const { rerender } = render(<Harness path={path} />);

    // The page refetches its path in place after a knowledge check, so the
    // hook is handed a new object for a path it has already revealed.
    rerender(<Harness path={freshPath()} />);

    expect(mockRevealPath).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on a path someone is already working through", () => {
    render(<Harness path={freshPath("path1", [step("step1", "FINISHED"), step("step2")])} />);

    expect(mockRevealPath).not.toHaveBeenCalled();
  });

  it("treats a started step as progress even while its status still says WAITING", () => {
    render(
      <Harness path={freshPath("path1", [step("step1", "WAITING", new Date().toISOString())])} />,
    );

    expect(mockRevealPath).not.toHaveBeenCalled();
  });

  it("stays quiet once a knowledge check has been passed", () => {
    const path = freshPath();
    path.phases[0].checkSummary.passed = true;

    render(<Harness path={path} />);

    expect(mockRevealPath).not.toHaveBeenCalled();
  });
});
