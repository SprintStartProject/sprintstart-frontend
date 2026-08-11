import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { TeamMemberFilters } from "../../../src/features/team-management/components/TeamMemberFilters";
import type { ProjectRole, TeamOverviewFilters } from "../../../src/features/team-management/types";

const roles: ProjectRole[] = [
  { id: "r1", name: "Developer", description: "" },
  { id: "r2", name: "Designer", description: "" },
];

const filters: TeamOverviewFilters = {
  roleId: "all",
  sortBy: "LONGEST_STEP",
};

describe("TeamMemberFilters Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <TeamMemberFilters roles={roles} filters={filters} onFiltersChange={vi.fn()} />
        </main>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("combobox", { name: "Filter team members by role" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort team members" })).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
