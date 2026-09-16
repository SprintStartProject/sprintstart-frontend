import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { TeamManagementPage } from "../../../src/pages/TeamManagementPage";
import { server } from "../../unit/setup/vitest.setup";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "project-1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "project-1",
        canManageSelected: true,
      }),
  };
});

// The metrics' attention list only feeds the "Needs you" filter; its own hook is tested apart.
vi.mock("../../../src/features/onboarding-metrics/hooks/useAttention", () => ({
  useAttention: () => ({ attention: null, isLoading: false, error: null, reload: vi.fn() }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(url = "/team-management") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/team-management"
          element={
            <>
              <TeamManagementPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function roster() {
  return screen.getByRole("list");
}

describe("TeamManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", async () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () => {
        return new Promise<never>(() => {});
      }),
    );

    renderPage();

    // The skeleton only appears after a short delay, so it never flashes on a fast load.
    expect(await screen.findByText("Loading team overview")).toBeInTheDocument();
  });

  it("offers members and roles, and nothing else", async () => {
    renderPage();

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();

    const tabs = within(screen.getByRole("group", { name: "Team management sections" }));
    expect(tabs.getAllByRole("button").map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("Members"),
      expect.stringContaining("Roles"),
    ]);
  });

  it("renders the selected project's members as rows", async () => {
    renderPage();

    await waitFor(() => {
      expect(within(roster()).getByText("Alice Smith")).toBeInTheDocument();
      expect(within(roster()).getByText("Bob Jones")).toBeInTheDocument();
    });
  });

  it("filters members by role", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Filter team members by role" }));
    await user.click(await screen.findByRole("option", { name: "Backend" }));

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    });
  });

  it("sorts members by progress", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Sort team members" }));
    await user.click(await screen.findByRole("option", { name: "Lowest progress" }));

    await waitFor(() => {
      const nameElements = within(roster()).getAllByText(/^(Bob Jones|Alice Smith)$/);
      expect(nameElements.map((el) => el.textContent)).toEqual(["Bob Jones", "Alice Smith"]);
    });
  });

  it("narrows to the status filter named in the URL, so the overview can link to it", async () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({
          content: [
            {
              userId: "user1",
              firstname: "Alice",
              lastname: "Smith",
              roles: [],
              skills: [],
              progressPercentage: 0.5,
              currentStep: {
                id: "s1",
                title: "Set up CI",
                startedAt: new Date().toISOString(),
                skip: {
                  id: "skip1",
                  stepId: "s1",
                  reason: "Done before",
                  status: "PENDING",
                  reviewComment: null,
                  reviewedAt: null,
                },
              },
              projectIds: [{ projectId: "project-1", name: "P", description: null }],
            },
            {
              userId: "user2",
              firstname: "Bob",
              lastname: "Jones",
              roles: [],
              skills: [],
              progressPercentage: 0.2,
              currentStep: null,
              projectIds: [{ projectId: "project-1", name: "P", description: null }],
            },
          ],
        }),
      ),
    );

    renderPage("/team-management?filter=waiting");

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Waiting on you/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens a member in the side panel through the URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Alice Smith/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("?member=user1");
  });

  it("shows the roles tab when the URL asks for it", async () => {
    renderPage("/team-management?tab=roles");

    const tabs = within(await screen.findByRole("group", { name: "Team management sections" }));
    expect(tabs.getByRole("button", { name: /Roles/ })).toHaveAttribute("aria-pressed", "true");
  });
});
