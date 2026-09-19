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
    updateStep: vi.fn(),
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

    expect(await screen.findByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("opens the Arrival tab from a ?tab=arrival deep link", async () => {
    renderTab("arrival");

    expect(await screen.findByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("opens the Starter work tab from a ?tab=starter deep link", async () => {
    renderTab("starter");

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
  });

  it("switches from Arrival to Starter work through the tab bar", async () => {
    renderTab("arrival");
    await screen.findByRole("button", { name: "Add step" });

    fireEvent.click(screen.getByRole("button", { name: "Starter work" }));

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
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

    expect(await screen.findByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  it("redirects /starter-work to the Starter work tab", async () => {
    renderRedirect("/starter-work");

    expect(await screen.findByTestId("add-tasks-menu")).toBeInTheDocument();
  });
});
