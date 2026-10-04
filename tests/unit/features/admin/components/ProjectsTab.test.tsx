import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsTab } from "../../../../../src/features/admin/components/ProjectsTab";
import type { AdminUser, ProjectOverview } from "../../../../../src/features/admin/types";

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
    industry: "",
    industryConfidence: null,
    industryCustom: false,
  },
  {
    id: "proj-2",
    name: "Beta",
    description: "",
    manager: null,
    sources: [],
    users: [],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
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
    expect(screen.getByText("1 member")).toBeInTheDocument();
    expect(screen.getByText("2 sources")).toBeInTheDocument();
    expect(screen.getByText("0 members")).toBeInTheDocument();
  });

  it("labels source types like the data ingestion page", () => {
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={vi.fn()} />);

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
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

  it("flags a project without a manager with a warning badge", () => {
    const withManager: ProjectOverview = {
      ...projects[0],
      id: "proj-3",
      name: "Gamma",
      manager: {
        id: "user-7",
        username: "jane.doe",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
      },
    };

    render(
      <ProjectsTab filteredProjects={[projects[0], withManager]} onOpenProjectDetails={vi.fn()} />,
    );

    expect(screen.getAllByText("No manager")).toHaveLength(1);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  describe("source health", () => {
    const withSources = (sources: ProjectOverview["sources"]): ProjectOverview => ({
      ...projects[0],
      sources,
    });

    it("says all synced when every source is connected", () => {
      render(<ProjectsTab filteredProjects={[projects[0]]} onOpenProjectDetails={vi.fn()} />);

      expect(screen.getByText("All synced")).toBeInTheDocument();
    });

    it("counts the sources that need attention", () => {
      render(
        <ProjectsTab
          filteredProjects={[
            withSources([
              { id: "s1", name: "A", type: "GITHUB", status: "CONNECTED" },
              { id: "s2", name: "B", type: "JIRA", status: "FAILED" },
            ]),
          ]}
          onOpenProjectDetails={vi.fn()}
        />,
      );

      expect(screen.getByText("1 needs attention")).toBeInTheDocument();
      expect(screen.queryByText("All synced")).not.toBeInTheDocument();
    });

    it("treats a disabled source as needing attention", () => {
      render(
        <ProjectsTab
          filteredProjects={[
            withSources([
              { id: "s1", name: "A", type: "GITHUB", status: "DISABLED" },
              { id: "s2", name: "B", type: "JIRA", status: "ERROR" },
            ]),
          ]}
          onOpenProjectDetails={vi.fn()}
        />,
      );

      expect(screen.getByText("2 need attention")).toBeInTheDocument();
    });

    it("says so when a project has no sources", () => {
      render(<ProjectsTab filteredProjects={[projects[1]]} onOpenProjectDetails={vi.fn()} />);

      expect(screen.getByText("No sources")).toBeInTheDocument();
    });
  });

  describe("member avatars", () => {
    const makeUsers = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `m-${index}`,
        username: `member${index}`,
        email: `member${index}@x.com`,
        projectRoles: [],
      }));

    const makeAdminUser = (id: string, firstName: string, lastName: string) =>
      ({
        id,
        username: `${firstName}.${lastName}`.toLowerCase(),
        email: "",
        firstName,
        lastName,
        profileIcon: null,
      }) as unknown as AdminUser;

    it("stacks the first four members and counts the rest", () => {
      render(
        <ProjectsTab
          filteredProjects={[{ ...projects[0], users: makeUsers(7) }]}
          onOpenProjectDetails={vi.fn()}
        />,
      );

      expect(screen.getByText("+3")).toBeInTheDocument();
      expect(screen.getByText("7 members")).toBeInTheDocument();
      expect(screen.getAllByRole("img", { name: /^Avatar for member/ })).toHaveLength(4);
    });

    it("shows no overflow chip for four members or fewer", () => {
      render(
        <ProjectsTab
          filteredProjects={[{ ...projects[0], users: makeUsers(4) }]}
          onOpenProjectDetails={vi.fn()}
        />,
      );

      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
    });

    it("names the avatars from the user directory", () => {
      render(
        <ProjectsTab
          filteredProjects={[{ ...projects[0], users: makeUsers(1) }]}
          users={[makeAdminUser("m-0", "Mia", "Wagner")]}
          onOpenProjectDetails={vi.fn()}
        />,
      );

      expect(screen.getByRole("img", { name: "Avatar for Mia Wagner" })).toBeInTheDocument();
    });
  });

  it("calls onOpenProjectDetails with the project when a card is clicked", async () => {
    const user = userEvent.setup();
    const onOpenProjectDetails = vi.fn();
    render(<ProjectsTab filteredProjects={projects} onOpenProjectDetails={onOpenProjectDetails} />);

    await user.click(screen.getByRole("button", { name: "Open details for Alpha" }));
    expect(onOpenProjectDetails).toHaveBeenCalledWith(projects[0]);
  });

  it("points at the search and filter when they leave nothing", () => {
    render(
      <ProjectsTab
        filteredProjects={[]}
        totalCount={3}
        isFiltered
        onOpenProjectDetails={vi.fn()}
      />,
    );

    expect(screen.getByText("No projects found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your search or filter.")).toBeInTheDocument();
  });

  it("shows the empty state when no projects are provided", () => {
    render(<ProjectsTab filteredProjects={[]} onOpenProjectDetails={vi.fn()} />);
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });
});
