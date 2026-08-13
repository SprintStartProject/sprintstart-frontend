import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamMemberFilters } from "../../../../../src/features/team-management/components/TeamMemberFilters";
import type {
  ProjectRole,
  TeamOverviewFilters,
} from "../../../../../src/features/team-management/types";

const mockRoles: ProjectRole[] = [
  { id: "r1", name: "Backend", description: "" },
  { id: "r2", name: "Frontend", description: "" },
];

const defaultFilters: TeamOverviewFilters = {
  roleId: "all",
  sortBy: "LONGEST_STEP",
};

/**
 * These controls are `FilterSelect`, not native selects, so the options only
 * exist in the DOM while the listbox is open and the trigger renders the
 * selected label as its own text.
 */
describe("TeamMemberFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers every role once opened", async () => {
    const user = userEvent.setup();
    render(
      <TeamMemberFilters roles={mockRoles} filters={defaultFilters} onFiltersChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Filter team members by role" }));

    expect(screen.getByRole("option", { name: "All roles" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Backend" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Frontend" })).toBeInTheDocument();
  });

  it("offers every sort order once opened", async () => {
    const user = userEvent.setup();
    render(
      <TeamMemberFilters roles={mockRoles} filters={defaultFilters} onFiltersChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Sort team members" }));

    expect(screen.getByRole("option", { name: "Longest on step" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Shortest on step" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Highest progress" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lowest progress" })).toBeInTheDocument();
  });

  it("calls onFiltersChange with new roleId when role is changed", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <TeamMemberFilters
        roles={mockRoles}
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Filter team members by role" }));
    await user.click(screen.getByRole("option", { name: "Backend" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, roleId: "r1" });
  });

  it("calls onFiltersChange with new sortBy when sort is changed", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <TeamMemberFilters
        roles={mockRoles}
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Sort team members" }));
    await user.click(screen.getByRole("option", { name: "Highest progress" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, sortBy: "HIGHEST_PROGRESS" });
  });

  it("reflects the current filter values on the triggers", () => {
    const filters: TeamOverviewFilters = { roleId: "r2", sortBy: "LOWEST_PROGRESS" };
    render(<TeamMemberFilters roles={mockRoles} filters={filters} onFiltersChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Filter team members by role" })).toHaveTextContent(
      "Frontend",
    );
    expect(screen.getByRole("combobox", { name: "Sort team members" })).toHaveTextContent(
      "Lowest progress",
    );
  });
});
