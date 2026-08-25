import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppRouter } from "../../../src/router/AppRouter";

/**
 * The guard decides on the profile and the selected project, so both are stubbed here and the
 * permission group is swapped per test.
 */
const auth = vi.hoisted(() => ({ permissionGroup: "USER", canManageSelected: true }));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "u1",
      username: "sam",
      permissionGroup: auth.permissionGroup,
      hasCompletedOnboarding: true,
    },
  }),
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
        canManageSelected: auth.canManageSelected,
      }),
  };
});

// The guard is what is under test, not what any of these pages render.
vi.mock("../../../src/router/AuthGuard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../../src/pages/StarterWorkPage", () => ({
  StarterWorkPage: () => <div>starter work page</div>,
}));
vi.mock("../../../src/pages/ArrivalStepsPage", () => ({
  ArrivalStepsPage: () => <div>arrival steps page</div>,
}));
vi.mock("../../../src/features/onboarding-metrics/components/OnboardingMetricsPage", () => ({
  OnboardingMetricsPage: () => <div>onboarding metrics page</div>,
}));
vi.mock("../../../src/pages/DashboardPage.tsx", () => ({
  DashboardPage: () => <div>dashboard page</div>,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

/**
 * The sidebar hides a manager surface from a hire; the URL does not. These routes are declared
 * PM/HR/ADMIN-only in `accessPolicy`, and before the guard was applied a hire who typed one got
 * the page and a column of failed requests — with the policy claiming otherwise.
 */
describe("manager-area routes", () => {
  const managerRoutes = [
    ["/starter-work", "starter work page"],
    ["/arrival-steps", "arrival steps page"],
    ["/insights/onboarding", "onboarding metrics page"],
  ] as const;

  it.each(managerRoutes)("sends a hire away from %s", async (path, marker) => {
    auth.permissionGroup = "USER";
    auth.canManageSelected = true;

    renderAt(path);

    await waitFor(() => {
      expect(screen.getByText("dashboard page")).toBeInTheDocument();
    });
    expect(screen.queryByText(marker)).not.toBeInTheDocument();
  });

  it.each(managerRoutes)("lets a managing PM reach %s", async (path, marker) => {
    auth.permissionGroup = "PM";
    auth.canManageSelected = true;

    renderAt(path);

    await waitFor(() => {
      expect(screen.getByText(marker)).toBeInTheDocument();
    });
  });

  /**
   * Only the routes in `MANAGER_ASSIGNMENT_ROUTES` additionally require managing the selected
   * project — the onboarding metrics are one of them, the two authoring pages are not.
   */
  it("keeps a PM who only takes part in the project off the onboarding metrics", async () => {
    auth.permissionGroup = "PM";
    auth.canManageSelected = false;

    renderAt("/insights/onboarding");

    await waitFor(() => {
      expect(screen.getByText("dashboard page")).toBeInTheDocument();
    });
    expect(screen.queryByText("onboarding metrics page")).not.toBeInTheDocument();
  });
});
