import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../setup/vitest.setup";
import { ProjectInsightsCard } from "../../../../../src/features/team-management/components/ProjectInsightsCard";

const PROJECT_ID = "project-1";

function projectResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    name: "SprintStart Frontend",
    description: "The web client",
    manager: null,
    sources: [{ id: "src-1", name: "acme/widgets", type: "GITHUB", status: "CONNECTED" }],
    users: [
      {
        id: "u1",
        username: "alice",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        roles: [],
        projectRoles: ["Backend"],
        enabled: true,
      },
      {
        id: "u2",
        username: "bob",
        email: "bob@example.com",
        firstName: "Bob",
        lastName: "Jones",
        roles: [],
        projectRoles: ["Backend", "Frontend"],
        enabled: true,
      },
    ],
    ...overrides,
  };
}

function serveProject(response: ReturnType<typeof projectResponse>) {
  server.use(http.get(`/api/v1/projects/${PROJECT_ID}`, () => HttpResponse.json(response)));
}

describe("ProjectInsightsCard", () => {
  it("names the project and counts its members", async () => {
    serveProject(projectResponse());

    render(<ProjectInsightsCard projectId={PROJECT_ID} />);

    expect(await screen.findByText("SprintStart Frontend")).toBeInTheDocument();
    expect(screen.getByText("2 members")).toBeInTheDocument();
  });

  it("lists every project role in use exactly once", async () => {
    serveProject(projectResponse());

    render(<ProjectInsightsCard projectId={PROJECT_ID} />);

    // "Backend" is on both members but is one role.
    expect(await screen.findByText("Backend")).toBeInTheDocument();
    expect(screen.getAllByText("Backend")).toHaveLength(1);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("names the connected sources", async () => {
    serveProject(projectResponse());

    render(<ProjectInsightsCard projectId={PROJECT_ID} />);

    expect(await screen.findByText("acme/widgets")).toBeInTheDocument();
  });

  it("says so when nothing is connected and no roles are assigned", async () => {
    serveProject(
      projectResponse({
        sources: [],
        users: [
          {
            id: "u1",
            username: "alice",
            email: "alice@example.com",
            firstName: "Alice",
            lastName: "Smith",
            roles: [],
            projectRoles: [],
            enabled: true,
          },
        ],
      }),
    );

    render(<ProjectInsightsCard projectId={PROJECT_ID} />);

    expect(await screen.findByText("None assigned yet")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();

    // Scoped to the Sources row: the ingestion block below says "Nothing
    // connected" too when it has no sources, so an unscoped query matches both.
    const sourcesRow = screen.getByText("Sources").closest("div");
    expect(sourcesRow).not.toBeNull();
    expect(within(sourcesRow!).getByText("Nothing connected")).toBeInTheDocument();
  });

  it("prefers an explicit title over the project name", async () => {
    serveProject(projectResponse());

    render(<ProjectInsightsCard projectId={PROJECT_ID} title="This project" />);

    expect(await screen.findByText("This project")).toBeInTheDocument();
    expect(screen.queryByText("SprintStart Frontend")).not.toBeInTheDocument();
  });

  it("surfaces the server's reason instead of showing an empty card", async () => {
    server.use(
      http.get(`/api/v1/projects/${PROJECT_ID}`, () =>
        HttpResponse.json({ message: "You do not manage this project." }, { status: 403 }),
      ),
    );

    render(<ProjectInsightsCard projectId={PROJECT_ID} />);

    // The API's own message, not the generic fallback: a manager who lost
    // access needs to know why, and "could not be loaded" would not say.
    expect(await screen.findByText("You do not manage this project.")).toBeInTheDocument();
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });
});
