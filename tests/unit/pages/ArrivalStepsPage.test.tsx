import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArrivalStepsPage } from "../../../src/pages/ArrivalStepsPage";
import { arrivalService } from "../../../src/services/arrivalService";

vi.mock("../../../src/services/arrivalService", () => ({
  arrivalService: {
    listSteps: vi.fn(),
    listDerivableSteps: vi.fn(),
    createStep: vi.fn(),
    reorderSteps: vi.fn(),
    deleteStep: vi.fn(),
  },
}));

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "p1", name: "Project One" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        selectedProjectId: "p1",
        projects: [project],
        selectedProject: project,
      }),
  };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "u1", permissionGroup: "PM" } }),
}));

describe("ArrivalStepsPage scope swipe", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
  });

  /**
   * The listener used to sit on `<main>`, which is only as tall as its content. A short list
   * leaves the bottom of the viewport outside it, and a swipe down there did nothing — worse
   * than the gesture being absent, because it works two centimetres higher up.
   *
   * Fired on the page header for the same reason the inbox's test does: jsdom has no layout, so
   * the empty band below the content cannot be aimed at, but the header is the same case —
   * outside `<main>`, inside the page — and it fails if the ref ever moves back to the panel.
   *
   * Reached through the page title rather than by role: the authoring section brings a banner of
   * its own, and the one this is about is the page's.
   */
  it("moves between scopes from anywhere on the page, not just over the list", async () => {
    render(<ArrivalStepsPage />);
    await screen.findByRole("button", { name: "Everyone" });
    const pageHeader = screen.getByRole("heading", { name: "Arrival" }).closest("header")!;

    // Rightwards past the hook's threshold: on to the scope after "Everyone".
    fireEvent.wheel(pageHeader, { deltaX: 60, deltaY: 0 });

    expect(await screen.findByRole("button", { name: "Project One" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("leaves a vertical scroll alone", async () => {
    render(<ArrivalStepsPage />);
    await screen.findByRole("button", { name: "Everyone" });
    const pageHeader = screen.getByRole("heading", { name: "Arrival" }).closest("header")!;

    fireEvent.wheel(pageHeader, { deltaX: 4, deltaY: 80 });

    expect(screen.getByRole("button", { name: "Everyone" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

/**
 * Every other page's header rule sits at the same height; Arrival's ran a line lower because its
 * subtitle was the longest in the app and wrapped where the others do not.
 */
describe("ArrivalStepsPage header", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
  });

  it("keeps the subtitle inside the band the other pages sit in", () => {
    render(<ArrivalStepsPage />);

    // Measured against the built stylesheet: at `max-w-2xl` and `text-sm` the subtitle wraps
    // past 105 characters, and every other page in the app is under that.
    const subtitle = screen.getByText(/What somebody needs before they can start/);
    expect(subtitle.textContent.length).toBeLessThanOrEqual(105);
  });
});
