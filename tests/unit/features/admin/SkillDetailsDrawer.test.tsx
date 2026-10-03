import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { SkillDetailsDrawer } from "../../../../src/features/admin/components/SkillDetailsDrawer";
import { ApiError } from "../../../../src/services/apiClient";
import type { ProjectRole, Skill } from "../../../../src/features/admin/types";

const mocks = vi.hoisted(() => ({
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
}));

vi.mock("../../../../src/services/teamManagementService", () => ({
  createSkill: mocks.createSkill,
  updateSkill: mocks.updateSkill,
  deleteSkill: mocks.deleteSkill,
}));

const roles: ProjectRole[] = [
  { id: "role-1", name: "Frontend", description: "" },
  { id: "role-2", name: "Backend", description: "" },
];

const activeSkill: Skill = {
  id: "skill-1",
  name: "React",
  roleIds: ["role-1"],
  status: "ACTIVE",
  category: "Engineering",
  universal: false,
};

const retiredSkill: Skill = {
  ...activeSkill,
  id: "skill-2",
  name: "jQuery",
  status: "RETIRED",
};

const render_ = (ui: Parameters<typeof render>[0]) => render(ui, { wrapper: ToastProvider });

/** Sets the Name field's value directly -- `userEvent.type`'s per-keystroke
 * timers are unreliable in this suite once a previous test's animations are
 * still settling, so the value is set in one synchronous change instead. */
function typeName(value: string) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value } });
}

describe("SkillDetailsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new skill and reports it back to the caller", async () => {
    const created: Skill = { ...activeSkill, id: "skill-new", name: "Vue" };
    mocks.createSkill.mockResolvedValue(created);
    const onSkillSaved = vi.fn();
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={null}
        skills={[]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={onSkillSaved}
      />,
    );

    typeName("Vue");
    await user.click(screen.getByRole("checkbox", { name: "Link Frontend to this skill" }));
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() =>
      expect(mocks.createSkill).toHaveBeenCalledWith({
        name: "Vue",
        roleIds: ["role-1"],
        category: null,
        universal: false,
      }),
    );
    expect(onSkillSaved).toHaveBeenCalledWith(created);
    expect(await screen.findByText("Skill created")).toBeInTheDocument();
  });

  it("reports a reactivation instead of a creation when the name matches a retired skill", async () => {
    mocks.createSkill.mockResolvedValue({ ...retiredSkill, status: "ACTIVE" });
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={null}
        skills={[retiredSkill]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={vi.fn()}
      />,
    );

    typeName(retiredSkill.name);
    await user.click(screen.getByRole("checkbox", { name: "Link Frontend to this skill" }));
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(await screen.findByText("Skill reactivated")).toBeInTheDocument();
  });

  it("shows a 409 name conflict as a field error rather than a toast", async () => {
    mocks.createSkill.mockRejectedValue(new ApiError(409, "Skill already exists"));
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={null}
        skills={[]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={vi.fn()}
      />,
    );

    typeName("React");
    await user.click(screen.getByRole("checkbox", { name: "Link Frontend to this skill" }));
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(await screen.findByText("Skill already exists")).toBeInTheDocument();
    expect(screen.queryByText("Skill created")).not.toBeInTheDocument();
  });

  it("blocks saving a skill with no roles unless it is marked universal", async () => {
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={null}
        skills={[]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={vi.fn()}
      />,
    );

    typeName("Orphan skill");
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(
      screen.getByText("Assign at least one role, or mark this skill as universal."),
    ).toBeInTheDocument();
    expect(mocks.createSkill).not.toHaveBeenCalled();
  });

  it("saves edits to an existing skill, sending the current category along", async () => {
    mocks.updateSkill.mockResolvedValue({ ...activeSkill, name: "ReactJS" });
    const onSkillSaved = vi.fn();
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={activeSkill}
        skills={[activeSkill]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={onSkillSaved}
      />,
    );

    typeName("ReactJS");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updateSkill).toHaveBeenCalledWith("skill-1", {
        name: "ReactJS",
        roleIds: ["role-1"],
        category: "Engineering",
        universal: false,
      }),
    );
    expect(onSkillSaved).toHaveBeenCalledWith({ ...activeSkill, name: "ReactJS" });
  });

  it("retires an active skill after the confirmation dialog is accepted", async () => {
    mocks.deleteSkill.mockResolvedValue(undefined);
    const onSkillSaved = vi.fn();
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={activeSkill}
        skills={[activeSkill]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={onSkillSaved}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Retire skill" }));
    await user.click(screen.getByRole("button", { name: "Retire" }));

    await waitFor(() => expect(mocks.deleteSkill).toHaveBeenCalledWith("skill-1"));
    expect(onSkillSaved).toHaveBeenCalledWith({ ...activeSkill, status: "RETIRED" });
    expect(await screen.findByText("Skill retired")).toBeInTheDocument();
  });

  it("reactivates using the skill's persisted name, ignoring an unsaved rename in the draft", async () => {
    mocks.createSkill.mockResolvedValue({ ...retiredSkill, status: "ACTIVE" });
    const user = userEvent.setup();

    render_(
      <SkillDetailsDrawer
        skill={retiredSkill}
        skills={[retiredSkill]}
        roles={roles}
        isOpen
        onClose={vi.fn()}
        onSkillSaved={vi.fn()}
      />,
    );

    typeName("Renamed but not saved");
    await user.click(screen.getByRole("button", { name: "Reactivate" }));

    await waitFor(() =>
      expect(mocks.createSkill).toHaveBeenCalledWith({
        name: retiredSkill.name,
        roleIds: retiredSkill.roleIds,
        category: retiredSkill.category,
        universal: retiredSkill.universal,
      }),
    );
    expect(await screen.findByText("Skill reactivated")).toBeInTheDocument();
  });
});
