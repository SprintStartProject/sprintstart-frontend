import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPageMocks, service } from "./support/blueprintPathMocks.ts";
import { pathFixture, renderPage, richPath, servePath } from "./support/blueprintPathPage.tsx";

vi.mock("../../../src/context/useAuth.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return { useAuth: () => ({ profile: { permissionGroup: session.permissionGroup } }) };
});
vi.mock("../../../src/features/projects/useProjectContext.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return {
    useProjectContext: () => ({
      selectedProjectId: session.selectedProjectId,
      isLoading: session.isProjectLoading,
    }),
  };
});
vi.mock("../../../src/context/useToast.ts", async () => {
  const { toast } = await import("./support/blueprintPathMocks.ts");
  return { useToast: () => toast };
});
vi.mock("../../../src/services/blueprintService.ts", async () => {
  const { service } = await import("./support/blueprintPathMocks.ts");
  return { blueprintService: service };
});

describe("BlueprintPathDetailPage outline", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
  });

  it("invites the author to add the first phase to an empty path", async () => {
    servePath(pathFixture("DRAFT", { blueprintPhases: [] }));
    renderPage();
    expect(await screen.findByText(/Build the path in phases/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add phase" })).toHaveLength(1);
  });

  it("draws every phase in position order with its type and description", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Get set up" })).toBeInTheDocument();
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText("Phase 2")).toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
    expect(screen.getByText("AI-enhanced")).toBeInTheDocument();
    expect(screen.getByText("Tooling and access")).toBeInTheDocument();
    expect(screen.getByText("No phase description.")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Get set up", "Learn the domain"]);
  });

  it("shows an AI phase's prompt and no steps or questions for it", async () => {
    renderPage();
    expect(await screen.findByText("Tailor it to the hire's role")).toBeInTheDocument();
    expect(screen.getAllByText("Steps")).toHaveLength(1);
    expect(screen.getAllByText("Knowledge check")).toHaveLength(1);
  });

  it("lists a fixed phase's steps with their details, tasks and resources", async () => {
    renderPage();
    expect(await screen.findByText("1. Clone the repo")).toBeInTheDocument();
    expect(screen.getByText("Get the code")).toBeInTheDocument();
    expect(screen.getByText(/DOCUMENT · 15 min ·/)).toBeInTheDocument();
    expect(screen.getByText(/Repo on disk/)).toBeInTheDocument();
    expect(screen.getByText("2. Build it")).toBeInTheDocument();
    expect(screen.getByText(/VIDEO · 30 min ·/)).toBeInTheDocument();
    expect(screen.getByText(/Run git clone/)).toBeInTheDocument();
    expect(screen.getByText("Git handbook")).toBeInTheDocument();
    expect(screen.getAllByText("Tasks")).toHaveLength(1);
    expect(screen.getAllByText("Resources")).toHaveLength(1);
  });

  it("lists the questions with their type, explanation and options", async () => {
    renderPage();
    expect(await screen.findByText("1. What is git?")).toBeInTheDocument();
    expect(screen.getByText("MULTIPLE CHOICE")).toBeInTheDocument();
    expect(screen.getByText("SHORT TEXT")).toBeInTheDocument();
    expect(screen.getByText("A VCS", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("2. Name the default branch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^A VCS$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^A fruit$/ })).toBeInTheDocument();
  });

  it("offers Add option only on a multiple-choice question", async () => {
    renderPage();
    await screen.findByText("1. What is git?");
    expect(screen.getAllByRole("button", { name: "Add option" })).toHaveLength(1);
  });

  it("says when a phase has no steps and no questions", async () => {
    servePath(
      pathFixture("DRAFT", {
        blueprintPhases: [
          { ...richPath().blueprintPhases[0], blueprintSteps: [], blueprintCheckQuestions: [] },
        ],
      }),
    );
    renderPage();
    expect(await screen.findByText("No steps in this phase.")).toBeInTheDocument();
    expect(screen.getByText("No questions in this phase.")).toBeInTheDocument();
  });

  it("lists the phase's requirements and says when there are none", async () => {
    renderPage();
    expect(await screen.findByText("Kotlin")).toBeInTheDocument();
    expect(screen.getByText("Skill:")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Role:")).toBeInTheDocument();
    expect(screen.getAllByText("No requirements yet.")).toHaveLength(1);
  });

  it("collapses and expands a phase", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Collapse phase Get set up" }));

    expect(screen.queryByText("1. Clone the repo")).not.toBeInTheDocument();
    expect(screen.queryByText("Phase 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit phase Get set up" })).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Expand phase Get set up" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(screen.getByText("1. Clone the repo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse phase Get set up" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("collapses and expands a step", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Collapse step Clone the repo" }));

    expect(screen.queryByText(/DOCUMENT · 15 min/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run git clone/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit step" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Expand step Clone the repo" }));
    expect(screen.getByText(/DOCUMENT · 15 min/)).toBeInTheDocument();
    expect(screen.getByText(/Run git clone/)).toBeInTheDocument();
  });

  it("collapses and expands a question", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Collapse question What is git?" }));

    expect(screen.queryByText("MULTIPLE CHOICE")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^A fruit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add option" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand question What is git?" }));
    expect(screen.getByRole("button", { name: /^A fruit$/ })).toBeInTheDocument();
  });

  it("shows prerequisites in the outline", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Learn the domain" });
    const section = screen.getByRole("heading", { name: "Learn the domain" }).closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText(/Get set up/)).toBeInTheDocument();
  });

  it("switches to the graph view and back, reloading the path on return", async () => {
    const user = userEvent.setup();
    service.getSubGraph.mockResolvedValue({ nodes: [] });
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });

    await user.click(screen.getByRole("button", { name: "Graph" }));
    await waitFor(() => expect(screen.queryByText("Phase 1")).not.toBeInTheDocument());
    const loads = service.getPath.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Outline" }));
    await waitFor(() => expect(service.getPath.mock.calls.length).toBe(loads + 1));
    expect(await screen.findByText("Phase 1")).toBeInTheDocument();
  });
});
