import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPageMocks, service } from "./support/blueprintPathMocks.ts";
import { PROJECT_SCOPE, renderPage, richPath, servePath } from "./support/blueprintPathPage.tsx";

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

/** Drags `from` onto `to` the way a browser fires it: start, over, drop, end. */
function drag(from: Element, to: Element) {
  const dataTransfer = { effectAllowed: "none" };
  fireEvent.dragStart(from, { dataTransfer });
  fireEvent.dragOver(to, { dataTransfer });
  fireEvent.drop(to, { dataTransfer });
  fireEvent.dragEnd(from, { dataTransfer });
}

function closest(text: string, selector: string, role?: "heading") {
  const element = role
    ? screen.getByRole(role, { name: new RegExp(text) })
    : screen.getByText(text, { exact: false });
  const found = element.closest(selector);
  if (!found) throw new Error(`${text} is not inside ${selector}`);
  return found;
}

function order(selector: string, within: HTMLElement = document.body) {
  return [...within.querySelectorAll(selector)].map((node) => node.textContent);
}

describe("BlueprintPathDetailPage reordering by dragging", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
  });

  it("moves a phase ahead of another and saves the position", async () => {
    service.updatePhasePosition.mockResolvedValue([
      { id: "phase-2", revision: 20, position: 0 },
      { id: "phase-1", revision: 21, position: 1 },
    ]);
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });

    drag(
      closest("Learn the domain", "section", "heading"),
      closest("Get set up", "section", "heading"),
    );

    await waitFor(() =>
      expect(service.updatePhasePosition).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-2", {
        revision: 9,
        position: 0,
      }),
    );
    await waitFor(() => expect(order("h2")).toEqual(["Learn the domain", "Get set up"]));
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
  });

  it("moves a step and saves the position", async () => {
    service.updateStepPosition.mockResolvedValue([
      { id: "step-2", revision: 30, position: 0 },
      { id: "step-1", revision: 31, position: 1 },
    ]);
    renderPage();
    await screen.findByText("2. Build it");

    drag(closest("Build it", "article"), closest("Clone the repo", "article"));

    await waitFor(() =>
      expect(service.updateStepPosition).toHaveBeenCalledWith(PROJECT_SCOPE, "step-2", {
        revision: 1,
        position: 0,
      }),
    );
    await waitFor(() => expect(screen.getByText("1. Build it")).toBeInTheDocument());
    expect(screen.getByText("2. Clone the repo")).toBeInTheDocument();
  });

  it("moves a task and saves the position", async () => {
    service.updateTaskPosition.mockResolvedValue([
      { id: "task-2", revision: 40, position: 0 },
      { id: "task-1", revision: 41, position: 1 },
    ]);
    renderPage();
    await screen.findByText(/Run git fetch/);

    drag(closest("Run git fetch", "li"), closest("Run git clone", "li"));

    await waitFor(() =>
      expect(service.updateTaskPosition).toHaveBeenCalledWith(PROJECT_SCOPE, "task-2", {
        revision: 13,
        position: 0,
      }),
    );
    await waitFor(() =>
      expect(order("li div[role=button]").slice(0, 2)).toEqual([
        "• Run git fetch",
        "• Run git clone",
      ]),
    );
  });

  it("moves a question and saves the position", async () => {
    service.updateQuestionPosition.mockResolvedValue([
      { id: "q-2", revision: 50, position: 0 },
      { id: "q-1", revision: 51, position: 1 },
    ]);
    renderPage();
    await screen.findByText("2. Name the default branch");

    drag(closest("Name the default branch", "article"), closest("What is git?", "article"));

    await waitFor(() =>
      expect(service.updateQuestionPosition).toHaveBeenCalledWith(PROJECT_SCOPE, "q-2", {
        revision: 8,
        position: 0,
      }),
    );
    await waitFor(() => expect(screen.getByText("1. Name the default branch")).toBeInTheDocument());
  });

  it("moves an option and saves the position", async () => {
    service.updateOptionPosition.mockResolvedValue([
      { id: "opt-2", revision: 60, position: 0 },
      { id: "opt-1", revision: 61, position: 1 },
    ]);
    renderPage();
    await screen.findByRole("button", { name: /^A fruit$/ });

    drag(
      screen.getByRole("button", { name: /^A fruit$/ }).closest("li") as Element,
      screen.getByRole("button", { name: /^A VCS$/ }).closest("li") as Element,
    );

    await waitFor(() =>
      expect(service.updateOptionPosition).toHaveBeenCalledWith(PROJECT_SCOPE, "opt-2", {
        revision: 7,
        position: 0,
      }),
    );
  });

  it("puts the page back to the server's view when a move is refused", async () => {
    service.updatePhasePosition.mockRejectedValue(new Error("Order changed elsewhere"));
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });
    const loads = service.getPath.mock.calls.length;

    drag(
      closest("Learn the domain", "section", "heading"),
      closest("Get set up", "section", "heading"),
    );

    expect(await screen.findByText("Order changed elsewhere")).toBeInTheDocument();
    await waitFor(() => expect(service.getPath.mock.calls.length).toBe(loads + 1));
    await waitFor(() => expect(order("h2")).toEqual(["Get set up", "Learn the domain"]));
  });

  it("uses a generic message when the refusal carries none", async () => {
    service.updatePhasePosition.mockRejectedValue("nope");
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });

    drag(
      closest("Learn the domain", "section", "heading"),
      closest("Get set up", "section", "heading"),
    );

    expect(await screen.findByText("The item could not be reordered.")).toBeInTheDocument();
  });

  it("ignores a drop of an item on itself", async () => {
    renderPage();
    const heading = await screen.findByRole("heading", { name: "Get set up" });
    const phase = heading.closest("section") as Element;

    drag(phase, phase);

    expect(service.updatePhasePosition).not.toHaveBeenCalled();
  });

  it("ignores a drop onto an item of another kind", async () => {
    renderPage();
    await screen.findByText("2. Build it");

    drag(closest("Build it", "article"), closest("Get set up", "section", "heading"));

    expect(service.updateStepPosition).not.toHaveBeenCalled();
    expect(service.updatePhasePosition).not.toHaveBeenCalled();
  });

  it("ignores a drop onto an item of another list", async () => {
    renderPage();
    await screen.findByText("2. Build it");

    // Options of the first question dropped on the second question's article: same kind of list
    // owner, different list.
    drag(
      screen.getByRole("button", { name: /^A fruit$/ }).closest("li") as Element,
      closest("Name the default branch", "article"),
    );

    expect(service.updateOptionPosition).not.toHaveBeenCalled();
  });

  it("offers a draft instead of reordering a published version", async () => {
    servePath(richPath("ACTIVE"));
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });

    drag(
      closest("Learn the domain", "section", "heading"),
      closest("Get set up", "section", "heading"),
    );

    expect(await screen.findByText("This version is published")).toBeInTheDocument();
    expect(service.updatePhasePosition).not.toHaveBeenCalled();
  });

  it("marks every item as draggable and allows dropping onto it", async () => {
    renderPage();
    const heading = await screen.findByRole("heading", { name: "Get set up" });
    const phase = heading.closest("section") as HTMLElement;
    expect(phase).toHaveAttribute("draggable", "true");

    const notPrevented = fireEvent.dragOver(phase);
    expect(notPrevented).toBe(false);
  });
});

describe("BlueprintPathDetailPage phase prerequisites in the outline", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
  });

  function laterPhase() {
    return screen
      .getByRole("heading", { name: "Learn the domain" })
      .closest("section") as HTMLElement;
  }

  it("shows what a phase waits for", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Learn the domain" });

    expect(
      within(laterPhase()).getByRole("button", { name: "Stop waiting for Get set up" }),
    ).toBeInTheDocument();
  });

  it("removes a prerequisite", async () => {
    const user = userEvent.setup();
    service.removeGraphNodeBlocker.mockResolvedValue({ revision: 10, blockerIds: [] });
    renderPage();
    await screen.findByRole("heading", { name: "Learn the domain" });

    await user.click(
      within(laterPhase()).getByRole("button", { name: "Stop waiting for Get set up" }),
    );

    await waitFor(() =>
      expect(service.removeGraphNodeBlocker).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "phase-2",
        "phase-1",
        9,
      ),
    );
    await waitFor(() =>
      expect(
        within(laterPhase()).queryByRole("button", { name: "Stop waiting for Get set up" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("adds a prerequisite from the other end", async () => {
    service.removeGraphNodeBlocker.mockResolvedValue({ revision: 10, blockerIds: [] });
    service.addGraphNodeBlocker.mockResolvedValue({ revision: 11, blockerIds: ["phase-1"] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Learn the domain" });
    await user.click(
      within(laterPhase()).getByRole("button", { name: "Stop waiting for Get set up" }),
    );
    await waitFor(() => expect(service.removeGraphNodeBlocker).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("combobox", { name: "Add something Get set up opens up" }));
    fireEvent.click(
      within(screen.getByRole("listbox", { name: "Add something Get set up opens up" })).getByRole(
        "option",
        { name: "Learn the domain" },
      ),
    );

    await waitFor(() =>
      expect(service.addGraphNodeBlocker).toHaveBeenCalledWith(
        PROJECT_SCOPE,
        "phase-2",
        "phase-1",
        10,
      ),
    );
  });

  it("offers a draft instead of changing prerequisites on a published version", async () => {
    servePath(richPath("ACTIVE"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Learn the domain" });

    await user.click(
      within(laterPhase()).getByRole("button", { name: "Stop waiting for Get set up" }),
    );

    expect(await screen.findByText("This version is published")).toBeInTheDocument();
    expect(service.removeGraphNodeBlocker).not.toHaveBeenCalled();
  });
});
