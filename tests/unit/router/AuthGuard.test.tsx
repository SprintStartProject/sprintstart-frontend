import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthGuard } from "../../../src/router/AuthGuard";
import { useAuth } from "../../../src/context/useAuth";
import * as teamManagementService from "../../../src/services/teamManagementService";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";
import { PermissionGroup, type UserProfile } from "../../../src/services/types";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../src/services/teamManagementService", () => ({
  getMyTeamOverview: vi.fn(),
  hasCompletedSkillAssessment: vi.fn(),
  getSkills: vi.fn(),
  getSkillAssessmentPromptState: vi.fn(),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const mockProfile: UserProfile = {
  id: "user1",
  authId: "auth-1",
  username: "testuser",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds: [],
  permissionGroup: PermissionGroup.USER,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: true,
};

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(teamManagementService.hasCompletedSkillAssessment).mockResolvedValue(true);
    vi.mocked(teamManagementService.getMyTeamOverview).mockResolvedValue({
      userId: "user1",
      firstname: "Test",
      lastname: "User",
      projects: [{ id: "proj1", name: "Test Project" }],
      roles: [],
      skills: [],
      progressPercentage: 50,
      currentPhase: { id: "phase1", title: "Phase 1" },
      currentStep: null,
      hasFeedback: false,
    });
    vi.mocked(teamManagementService.getSkills).mockResolvedValue([]);
    vi.mocked(teamManagementService.getSkillAssessmentPromptState).mockReturnValue(null);
  });

  it("renders loading spinner when status is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "loading",
      profile: null,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <div>Protected</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("redirects to /login if unauthenticated and not on /login", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      profile: null,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<LocationDisplay />} />
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <LocationDisplay />
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });
  });

  it("redirects to / if authenticated and on /login", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({
          users: [
            {
              userId: "user1",
              firstname: "Test",
              lastname: "User",
              email: "test@example.com",
              roles: [],
              progressPercentage: 50,
              currentStep: null,
              skills: [],
            },
          ],
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/" element={<LocationDisplay />} />
          <Route
            path="/login"
            element={
              <AuthGuard>
                <div>Login Page</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
  });

  it("preserves full deep link with search and hash when unauthenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      profile: null,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/insights/faq/42?filter=active#details"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <div>
                <LocationDisplay />
                <span data-testid="search">{window.location.search}</span>
              </div>
            }
          />
          <Route
            path="/insights/faq/:id"
            element={
              <AuthGuard>
                <LocationDisplay />
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });
    expect(sessionStorage.getItem("sprintstart_auth_redirect")).toBe(
      "/insights/faq/42?filter=active#details",
    );
  });

  it("redirects authenticated user on /login to the intended deep link in query parameter", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login?redirect=%2Finsights%2Ffaq%2F42%3Ftab%3D1%23sec"]}>
        <Routes>
          <Route path="/insights/faq/:id" element={<LocationDisplay />} />
          <Route
            path="/login"
            element={
              <AuthGuard>
                <div>Login Page</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/insights/faq/42");
    });
  });

  it("redirects authenticated user on /login to target stored in location state", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: {
              from: { pathname: "/team/user-42", search: "?tab=skills" },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/team/:userId" element={<LocationDisplay />} />
          <Route
            path="/login"
            element={
              <AuthGuard>
                <div>Login Page</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/team/user-42");
    });
  });

  it("safely falls back to default route when redirect parameter is external or malicious", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/login?redirect=https%3A%2F%2Fmalicious.com%2Fsteal"]}>
        <Routes>
          <Route path="/" element={<LocationDisplay />} />
          <Route
            path="/login"
            element={
              <AuthGuard>
                <div>Login Page</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
  });

  it("restores stored session target when authenticated user lands on /", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    sessionStorage.setItem("sprintstart_auth_redirect", "/insights/faq/42?filter=active#details");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/insights/faq/:id" element={<LocationDisplay />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <div>Root Dashboard</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/insights/faq/42");
    });
    expect(sessionStorage.getItem("sprintstart_auth_redirect")).toBeNull();
  });

  it("renders children when authenticated and no skill assessment needed", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({
          users: [
            {
              userId: "user1",
              firstname: "Test",
              lastname: "User",
              email: "test@example.com",
              roles: [],
              progressPercentage: 50,
              currentStep: null,
              skills: [],
            },
          ],
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <div data-testid="protected-content">Protected Content</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
  });

  it("redirects to /skill-wizard if skill assessment is needed", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    vi.mocked(teamManagementService.getMyTeamOverview).mockResolvedValue({
      userId: "user1",
      firstname: "Test",
      lastname: "User",
      projects: [{ id: "proj1", name: "Test Project" }],
      roles: [{ id: "role1", name: "Developer", description: "Developer role" }],
      skills: [],
      progressPercentage: 50,
      currentPhase: { id: "phase1", title: "Phase 1" },
      currentStep: null,
      hasFeedback: false,
    });
    vi.mocked(teamManagementService.hasCompletedSkillAssessment).mockResolvedValue(false);
    vi.mocked(teamManagementService.getSkills).mockResolvedValue([
      {
        id: "skill1",
        roleIds: ["role1"],
        name: "Typescript",
        status: "ACTIVE",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/skill-wizard" element={<LocationDisplay />} />
          <Route
            path="/protected"
            element={
              <AuthGuard>
                <div data-testid="protected-content">Protected Content</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/skill-wizard");
    });
  });
});
