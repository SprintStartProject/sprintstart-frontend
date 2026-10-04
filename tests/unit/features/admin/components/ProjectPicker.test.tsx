import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectPicker } from "../../../../../src/features/admin/components/ProjectPicker";
import type { ProjectOverview } from "../../../../../src/features/admin/types";

const project = (id: string, name: string, overrides: Partial<ProjectOverview> = {}) =>
  ({
    id,
    name,
    description: "",
    manager: null,
    sources: [],
    users: [],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
    ...overrides,
  }) satisfies ProjectOverview;

const projects = [
  project("proj-1", "Alpha"),
  project("proj-2", "Beta", {
    manager: { id: "m", username: "boss", email: "", firstName: "Bea", lastName: "Boss" },
    users: [{ id: "u", username: "u", email: "", projectRoles: [] }],
  }),
  project("proj-3", "Gamma"),
];

describe("ProjectPicker", () => {
  const onSelect = vi.fn().mockResolvedValue(true);

  function renderPicker(props: Partial<Parameters<typeof ProjectPicker>[0]> = {}) {
    return render(
      <ProjectPicker
        projects={projects}
        excludedIds={new Set(["proj-1"])}
        label="Add project"
        title="Add to project"
        pendingProjectId={null}
        onSelect={onSelect}
        {...props}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onSelect.mockResolvedValue(true);
  });

  it("lists the projects that are not excluded, with members and manager but no ids", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: /Add project/i }));

    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("1 member · Bea Boss")).toBeInTheDocument();
    expect(screen.getByText("0 members · No manager")).toBeInTheDocument();
    expect(screen.queryByText("proj-2")).not.toBeInTheDocument();
  });

  it("shows the title and hint", async () => {
    const user = userEvent.setup();
    renderPicker({ title: "Move to project", hint: "Replaces Alpha" });

    await user.click(screen.getByRole("button", { name: /Add project/i }));

    expect(screen.getByText("Move to project")).toBeInTheDocument();
    expect(screen.getByText("Replaces Alpha")).toBeInTheDocument();
  });

  it("filters by name", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: /Add project/i }));
    await user.type(screen.getByPlaceholderText("Search projects..."), "gam");

    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("tells a search without hits apart from having nothing left to offer", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPicker();

    await user.click(screen.getByRole("button", { name: /Add project/i }));
    await user.type(screen.getByPlaceholderText("Search projects..."), "zzz");

    expect(screen.getByText('No projects match "zzz".')).toBeInTheDocument();

    rerender(
      <ProjectPicker
        projects={projects}
        excludedIds={new Set(projects.map((entry) => entry.id))}
        label="Add project"
        title="Add to project"
        pendingProjectId={null}
        onSelect={onSelect}
      />,
    );
    await user.clear(screen.getByPlaceholderText("Search projects..."));

    expect(screen.getByText("No other projects available.")).toBeInTheDocument();
  });

  it("selects a project and closes once it is saved", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: /Add project/i }));
    await user.click(screen.getByText("Beta"));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("proj-2"));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Search projects...")).not.toBeInTheDocument(),
    );
  });

  it("stays open when the selection was cancelled or failed", async () => {
    onSelect.mockResolvedValue(false);
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("button", { name: /Add project/i }));
    await user.click(screen.getByText("Beta"));

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(screen.getByPlaceholderText("Search projects...")).toBeInTheDocument();
  });

  it("closes on Escape without anything else seeing the key", async () => {
    const user = userEvent.setup();
    const onDocumentKeyDown = vi.fn();
    document.addEventListener("keydown", onDocumentKeyDown);
    renderPicker();

    await user.click(screen.getByRole("button", { name: /Add project/i }));
    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("Search projects...")).not.toBeInTheDocument();
    expect(onDocumentKeyDown).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onDocumentKeyDown);
  });
});
