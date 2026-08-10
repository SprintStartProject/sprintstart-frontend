import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsTab } from "../../../../../src/features/admin/components/ProjectsTab";
import type { ProjectOverview } from "../../../../../src/features/admin/types";

const projects: ProjectOverview[] = [
  {
    id: "proj-1",
    name: "Alpha",
    description: "Alpha project description",
    manager: null,
    sources: [
      { id: "src-1", name: "Repo A", type: "GITHUB", status: "CONNECTED" },
      { id: "src-2", name: "Repo B", type: "JIRA", status: "CONNECTED" },
    ],
    users: [{ id: "u-1", username: "a", email: "a@x.com", projectRoles: [] }],
  },
  {
    id: "proj-2",
    name: "Beta",
    description: "",
    manager: null,
    sources: [],
    users: [],
  },
];

describe("ProjectsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a card for each project", () => {
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Open details for Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open details for Beta" })).toBeInTheDocument();
    expect(screen.getByText("Alpha project description")).toBeInTheDocument();
  });

  it("shows a fallback description when none is provided", () => {
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={vi.fn()} />);
    expect(screen.getByText("No project description available yet.")).toBeInTheDocument();
  });

  it("renders source count and member count metadata", () => {
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={vi.fn()} />);
    expect(screen.getByText("1 members")).toBeInTheDocument();
    expect(screen.getByText("2 sources")).toBeInTheDocument();
  });

  it("names the assigned project manager on the card", () => {
    const withManager: ProjectOverview[] = [
      {
        ...projects[0],
        manager: {
          id: "user-7",
          username: "jane.doe",
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Doe",
        },
      },
    ];

    render(<ProjectsTab filteredProjects={withManager} onOpenProjectDetails={vi.fn()} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("marks a project without a manager", () => {
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={vi.fn()} />);

    expect(screen.getAllByText("No manager")).toHaveLength(2);
  });

  it("calls onOpenProjectDetails with the project when a card is clicked", async () => {
    const user = userEvent.setup();
    const onOpenProjectDetails = vi.fn();
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={onOpenProjectDetails} />);

    await user.click(screen.getByRole("button", { name: "Open details for Alpha" }));
    expect(onOpenProjectDetails).toHaveBeenCalledWith(projects[0]);
  });

  it("shows the empty state when no projects are provided", () => {
    render(<ProjectsTab filteredProjects={[]} onOpenProjectDetails={vi.fn()} />);
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });
});
