import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirstWeekPage } from "../../../src/pages/FirstWeekPage";
import { arrivalService } from "../../../src/services/arrivalService";
import { starterWorkService } from "../../../src/services/starterWorkService";
import { userService } from "../../../src/services/userService";

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

function renderTab(tab: "arrival" | "starter") {
  return render(
    <MemoryRouter initialEntries={[`/first-week?tab=${tab}`]}>
      <FirstWeekPage />
    </MemoryRouter>,
  );
}

describe("FirstWeekPage tab switching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
  });

  it("defaults to the Arrival tab when no ?tab= is given", async () => {
    render(
      <MemoryRouter initialEntries={["/first-week"]}>
        <FirstWeekPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Arrival" })).toBeInTheDocument();
  });

  it("opens the Starter work tab from a ?tab=starter deep link", async () => {
    renderTab("starter");

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
  });

  it("switches from Arrival to Starter work through the tab bar", async () => {
    renderTab("arrival");
    await screen.findByRole("heading", { name: "Arrival" });

    fireEvent.click(screen.getByRole("button", { name: "Starter work" }));

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
  });
});

describe("Arrival tab scope swipe", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
  });

  /**
   * The listener sits on the Arrival section's own wrapper, not `<main>`, which is only as tall
   * as its content -- see the note in `ArrivalSection`. Fired on the section's own header for the
   * same reason the inbox's test does: jsdom has no layout, so the empty band below the content
   * cannot be aimed at, but the header is the same case -- outside its `<main>`, inside the
   * section -- and it fails if the ref ever moves back to the panel.
   */
  it("moves between scopes from anywhere on the section, not just over the list", async () => {
    renderTab("arrival");
    await screen.findByRole("button", { name: "Everyone" });
    const sectionHeader = screen.getByRole("heading", { name: "Arrival" }).closest("header")!;

    // Rightwards past the hook's threshold: on to the scope after "Everyone".
    fireEvent.wheel(sectionHeader, { deltaX: 60, deltaY: 0 });

    expect(await screen.findByRole("button", { name: "Project One" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("leaves a vertical scroll alone", async () => {
    renderTab("arrival");
    await screen.findByRole("button", { name: "Everyone" });
    const sectionHeader = screen.getByRole("heading", { name: "Arrival" }).closest("header")!;

    fireEvent.wheel(sectionHeader, { deltaX: 4, deltaY: 80 });

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
describe("Arrival section header", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
  });

  it("keeps the subtitle inside the band the other pages sit in", async () => {
    renderTab("arrival");

    // Measured against the built stylesheet: at `max-w-2xl` and `text-sm` the subtitle wraps
    // past 105 characters, and every other page in the app is under that.
    const subtitle = await screen.findByText(/What somebody needs before they can start/);
    expect(subtitle.textContent.length).toBeLessThanOrEqual(105);
  });
});

describe("old First Week routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchUnreviewed").mockResolvedValue({ tasks: [] });
    vi.spyOn(starterWorkService, "fetchPool").mockResolvedValue([]);
    vi.spyOn(starterWorkService, "fetchCandidates").mockResolvedValue([]);
    vi.spyOn(userService, "getMyProjects").mockResolvedValue([]);
  });

  function renderRedirect(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/arrival-steps"
            element={<Navigate to="/first-week?tab=arrival" replace />}
          />
          <Route path="/starter-work" element={<Navigate to="/first-week?tab=starter" replace />} />
          <Route path="/first-week" element={<FirstWeekPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("redirects /arrival-steps to the Arrival tab", async () => {
    renderRedirect("/arrival-steps");

    expect(await screen.findByRole("heading", { name: "Arrival" })).toBeInTheDocument();
  });

  it("redirects /starter-work to the Starter work tab", async () => {
    renderRedirect("/starter-work");

    expect(await screen.findByRole("heading", { name: "Starter Work" })).toBeInTheDocument();
  });
});
