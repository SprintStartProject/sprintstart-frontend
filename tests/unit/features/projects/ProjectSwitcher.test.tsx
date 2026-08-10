import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { ProjectSwitcher } from "../../../../src/features/projects/components/ProjectSwitcher";
import type { SelectableProject } from "../../../../src/features/projects/ProjectContext";

const setSelectedProjectId = vi.fn();

const contextValue = {
  projects: [] as SelectableProject[],
  selectedProject: null as SelectableProject | null,
  selectedProjectId: "",
  canManageSelected: false,
  isSwitcherEnabled: true,
  isLoading: false,
  errorMessage: null as string | null,
  setSelectedProjectId,
  reloadProjects: vi.fn(),
};

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => contextValue,
}));

function project(
  id: string,
  name: string,
  isManaged: boolean,
  overrides: Partial<SelectableProject> = {},
): SelectableProject {
  return {
    id,
    name,
    description: "",
    manager: null,
    sources: [],
    users: [],
    isManaged,
    memberCount: 3,
    sourceCount: 2,
    ...overrides,
  };
}

const managed = project("p1", "Apollo", true);
const member = project("p2", "Borealis", false);

const triggerName = /Current project: Apollo/;

describe("ProjectSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue.projects = [managed, member];
    contextValue.selectedProject = managed;
    contextValue.selectedProjectId = "p1";
    contextValue.isSwitcherEnabled = true;
    contextValue.isLoading = false;
    contextValue.errorMessage = null;
  });

  it("renders nothing for permission groups without a switcher", () => {
    contextValue.isSwitcherEnabled = false;

    const { container } = render(<ProjectSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  it("exposes the current project and has no axe violations when open", async () => {
    const user = userEvent.setup();
    // Wrapped in a landmark because the switcher normally lives inside the
    // sidebar's <aside>; rendering it bare trips axe's region rule.
    const { baseElement } = render(
      <nav aria-label="Sidebar">
        <ProjectSwitcher />
      </nav>,
    );

    const trigger = screen.getByRole("button", { name: triggerName });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("shows member and source counts on the project cards", async () => {
    const user = userEvent.setup();
    contextValue.projects = [project("p1", "Apollo", true, { memberCount: 1, sourceCount: 4 })];

    render(<ProjectSwitcher />);
    await user.click(screen.getByRole("button", { name: triggerName }));

    const card = screen.getByRole("option", { name: /Apollo/ });
    expect(within(card).getByText("1 member")).toBeInTheDocument();
    expect(within(card).getByText("4 sources")).toBeInTheDocument();
  });

  it("omits counts that are unknown at the current access level", async () => {
    const user = userEvent.setup();
    contextValue.projects = [
      project("p2", "Borealis", false, { memberCount: null, sourceCount: null }),
    ];
    contextValue.selectedProjectId = "p2";

    render(<ProjectSwitcher />);
    await user.click(screen.getByRole("button", { name: /Current project: Apollo/ }));

    const card = screen.getByRole("option", { name: /Borealis/ });
    expect(within(card).queryByText(/member/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/source/)).not.toBeInTheDocument();
  });

  it("marks the selected project and groups managed projects separately", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await user.click(screen.getByRole("button", { name: triggerName }));

    expect(screen.getByRole("option", { name: /Apollo/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Borealis/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    // "Managed by you" also labels the trigger and the card badge, so scope
    // the group-header assertions to the listbox.
    const listbox = screen.getByRole("listbox", { name: "Projects" });
    expect(within(listbox).getAllByText("Managed by you").length).toBeGreaterThan(0);
    expect(within(listbox).getByText("Member of")).toBeInTheDocument();
  });

  it("filters projects by the search term", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await user.click(screen.getByRole("button", { name: triggerName }));
    await user.type(screen.getByRole("searchbox", { name: "Search projects" }), "bore");

    expect(screen.queryByRole("option", { name: /Apollo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Borealis/ })).toBeInTheDocument();
  });

  it("selects the only remaining match when confirming from the search field", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await user.click(screen.getByRole("button", { name: triggerName }));
    await user.type(screen.getByRole("searchbox", { name: "Search projects" }), "bore{Enter}");

    expect(setSelectedProjectId).toHaveBeenCalledWith("p2");
  });

  it("selects a project by clicking its card", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await user.click(screen.getByRole("button", { name: triggerName }));
    await user.click(screen.getByRole("option", { name: /Borealis/ }));

    expect(setSelectedProjectId).toHaveBeenCalledWith("p2");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    const trigger = screen.getByRole("button", { name: triggerName });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("surfaces a loading state instead of an empty grid", async () => {
    const user = userEvent.setup();
    contextValue.isLoading = true;
    contextValue.projects = [];

    render(<ProjectSwitcher />);
    await user.click(screen.getByRole("button", { name: triggerName }));

    expect(screen.getByText("Loading projects...")).toBeInTheDocument();
  });

  it("does not throw on a synthetic keydown with no key (browser-extension event)", () => {
    // jsdom (like a real browser) does NOT re-throw synchronously when a
    // window event listener throws; instead it reports the exception via
    // a window "error" event. So we capture those to detect the crash.
    // Before the guard, the ProjectSwitcher listener called
    // `.toLowerCase()` on an undefined `key` and threw
    // "Cannot read properties of undefined (reading 'toLowerCase')".
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.message);
    window.addEventListener("error", onError);

    render(<ProjectSwitcher />);
    window.dispatchEvent(new Event("keydown"));

    window.removeEventListener("error", onError);
    expect(errors).toEqual([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the switcher on Cmd/Ctrl+K", () => {
    render(<ProjectSwitcher />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(screen.getByRole("dialog", { name: "Switch project" })).toBeInTheDocument();
  });
});
