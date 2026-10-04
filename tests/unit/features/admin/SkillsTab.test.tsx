import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillsTab } from "../../../../src/features/admin/components/SkillsTab";
import type { ProjectRole, Skill } from "../../../../src/features/admin/types";

const roles: ProjectRole[] = [
  { id: "role-1", name: "Frontend", description: "" },
  { id: "role-2", name: "Backend", description: "" },
];

const skills: Skill[] = [
  {
    id: "skill-1",
    name: "React",
    roleIds: ["role-1"],
    status: "ACTIVE",
    category: "Engineering",
    universal: false,
  },
  {
    id: "skill-2",
    name: "Communication",
    roleIds: [],
    status: "RETIRED",
    category: null,
    universal: true,
  },
];

const defaultProps = {
  skills,
  roles,
  loadingState: "success" as const,
  errorMessage: "",
  hasSearchQuery: false,
  totalCount: skills.length,
  onOpenSkillDetails: vi.fn(),
  onRetryLoad: vi.fn(),
};

describe("SkillsTab", () => {
  it("shows a loading state while the pool is being fetched", () => {
    render(<SkillsTab {...defaultProps} loadingState="loading" skills={[]} />);

    expect(screen.getByText("Loading skills...")).toBeInTheDocument();
  });

  it("shows an error state with a retry action", async () => {
    const onRetryLoad = vi.fn();
    const user = userEvent.setup();

    render(
      <SkillsTab
        {...defaultProps}
        loadingState="error"
        errorMessage="Network down"
        skills={[]}
        onRetryLoad={onRetryLoad}
      />,
    );

    expect(screen.getByText("Skills could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Network down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryLoad).toHaveBeenCalledTimes(1);
  });

  it("shows a first-time empty state when the pool itself is empty", () => {
    render(<SkillsTab {...defaultProps} skills={[]} totalCount={0} />);

    expect(screen.getByText("No skills yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create the first skill to start building the pool."),
    ).toBeInTheDocument();
  });

  it("shows a search-specific empty state when a filter hides every skill", () => {
    render(<SkillsTab {...defaultProps} skills={[]} hasSearchQuery totalCount={skills.length} />);

    expect(screen.getByText("No skills found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your search term.")).toBeInTheDocument();
  });

  it("shows a filter-specific empty state when a non-search filter hides every skill", () => {
    render(
      <SkillsTab {...defaultProps} skills={[]} hasSearchQuery={false} totalCount={skills.length} />,
    );

    expect(screen.getByText("No skills found")).toBeInTheDocument();
    expect(screen.getByText("Try another search term or change the filters.")).toBeInTheDocument();
  });

  it("renders each skill's name, category, roles, universal badge and status", () => {
    render(<SkillsTab {...defaultProps} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    expect(screen.getByText("Communication")).toBeInTheDocument();
    // "Universal" also labels the column header, so the badge is only one of two matches.
    expect(screen.getAllByText("Universal").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Retired")).toBeInTheDocument();
    expect(screen.getByText("No roles")).toBeInTheDocument();
  });

  it("opens a skill's details when its row is clicked", async () => {
    const onOpenSkillDetails = vi.fn();
    const user = userEvent.setup();

    render(<SkillsTab {...defaultProps} onOpenSkillDetails={onOpenSkillDetails} />);

    await user.click(screen.getByRole("button", { name: "Open details for React" }));

    expect(onOpenSkillDetails).toHaveBeenCalledWith(skills[0]);
  });
});
