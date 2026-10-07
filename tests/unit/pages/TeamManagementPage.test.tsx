import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
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

// The roles tab reads who is signed in to decide what they may change there.
vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "pm-1", permissionGroup: "PM" } }),
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
        <Route path="/team/:userId" element={<ProfileProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function ProfileProbe() {
  const { userId } = useParams();
  const location = useLocation();
  return (
    <>
      <p>profile of {userId}</p>
      <output>{location.search}</output>
    </>
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

  // Members and Roles are views grown out of the workspace's Team tab (see PmWorkspace.test);
  // the section draws no tab bar of its own, and opens on the same row of figures as the other
  // PM lists.
  it("opens on the team's figures, with no tab bar of its own", async () => {
    renderPage();

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Team management sections" }),
    ).not.toBeInTheDocument();
    const figures = within(screen.getByRole("region", { name: "Key figures" }));
    expect(figures.getByText("Members")).toBeInTheDocument();
    expect(figures.getByText("Average progress")).toBeInTheDocument();
  });

  it("moves to the roles from their figure", async () => {
    const user = userEvent.setup();
    renderPage();

    const figures = within(await screen.findByRole("region", { name: "Key figures" }));
    await user.click(figures.getByRole("button", { name: /Roles/ }));

    expect(screen.getByTestId("location")).toHaveTextContent("?tab=roles");
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

    // The column header sorts: the first press is highest first, the second flips it.
    const progressHeader = screen.getByRole("button", { name: "Sort by progress" });
    await user.click(progressHeader);
    await user.click(progressHeader);

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

    // "waiting" is what the overview linked to before it was merged into "needs you"; old links
    // still land on the merged filter.
    renderPage("/team-management?filter=waiting");

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Needs you/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens a member in the side panel through the URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Alice Smith/ }));

    // A single click waits a moment to be sure it is not the first half of a double click.
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("?member=user1");
    });
  });

  it("opens a member's full profile on a double click, without the side panel", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.dblClick(await screen.findByRole("button", { name: /Alice Smith/ }));

    expect(await screen.findByText("profile of user1")).toBeInTheDocument();
    // Well past the single-click delay: the first click of the pair must not open the panel.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByText("?member=user1")).not.toBeInTheDocument();
  });

  it("shows the roles when the URL asks for them", async () => {
    renderPage("/team-management?tab=roles");

    // Creating a role sits behind the roles toolbar's "New role".
    expect(await screen.findByRole("button", { name: "New role" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search members" })).not.toBeInTheDocument();
  });

  it("resets search, filters and sort together", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByRole("textbox", { name: "Search members" }), "alice");
    await waitFor(() => expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });
});
