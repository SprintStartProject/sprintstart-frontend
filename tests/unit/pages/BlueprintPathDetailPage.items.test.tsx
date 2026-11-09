import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPageMocks, service, toast } from "./support/blueprintPathMocks.ts";
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

type User = ReturnType<typeof userEvent.setup>;

async function confirmDelete(user: User, trigger: string, confirm: string) {
  await user.click(await screen.findByRole("button", { name: trigger }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: confirm }));
  return dialog;
}

describe("BlueprintPathDetailPage deleting content", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
  });

  it("deletes a phase and drops it, and the prerequisite that pointed at it", async () => {
    const user = userEvent.setup();
    service.deletePhase.mockResolvedValue({ updatedPhases: [{ id: "phase-2", revision: 10 }] });
    renderPage();

    await confirmDelete(user, "Delete phase Get set up", "Delete phase");

    await waitFor(() =>
      expect(service.deletePhase).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", 1),
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Get set up" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Learn the domain" })).toBeInTheDocument();
  });

  it("deletes a task and reloads the path", async () => {
    const user = userEvent.setup();
    service.deleteTask.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Get set up" });
    const loads = service.getPath.mock.calls.length;

    await confirmDelete(user, "Delete task Run git clone", "Delete task");

    await waitFor(() =>
      expect(service.deleteTask).toHaveBeenCalledWith(PROJECT_SCOPE, "task-1", 3),
    );
    await waitFor(() => expect(service.getPath.mock.calls.length).toBe(loads + 1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("deletes a resource", async () => {
    const user = userEvent.setup();
    service.deleteResource.mockResolvedValue(undefined);
    renderPage();

    await confirmDelete(user, "Delete resource Git handbook", "Delete resource");

    await waitFor(() =>
      expect(service.deleteResource).toHaveBeenCalledWith(PROJECT_SCOPE, "res-1", 4),
    );
  });

  it("deletes an option", async () => {
    const user = userEvent.setup();
    service.deleteOption.mockResolvedValue(undefined);
    renderPage();

    await confirmDelete(user, "Delete option A fruit", "Delete option");

    await waitFor(() =>
      expect(service.deleteOption).toHaveBeenCalledWith(PROJECT_SCOPE, "opt-2", 7),
    );
  });

  it("names what it is about to delete and what goes with it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete task Run git clone" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete task "Run git clone"?')).toBeInTheDocument();
    expect(within(dialog).getByText(/disappears from this step/)).toBeInTheDocument();
  });

  it("keeps the item and explains when a delete failed", async () => {
    const user = userEvent.setup();
    service.deleteTask.mockRejectedValue(new Error("Stale revision"));
    renderPage();

    const dialog = await confirmDelete(user, "Delete task Run git clone", "Delete task");

    expect(await within(dialog).findByText("Stale revision")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^• Run git clone$/ })).toBeInTheDocument();
  });

  it("cancels a delete without sending it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete option A fruit" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(service.deleteOption).not.toHaveBeenCalled();
  });

  it("offers a draft instead of a delete on a published version", async () => {
    const user = userEvent.setup();
    servePath(richPath("ACTIVE"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete task Run git clone" }));

    expect(await screen.findByText("This version is published")).toBeInTheDocument();
    expect(screen.queryByText('Delete task "Run git clone"?')).not.toBeInTheDocument();
  });
});

describe("BlueprintPathDetailPage phase requirements", () => {
  const catalog = {
    skills: [
      { id: "skill-1", name: "Kotlin" },
      { id: "skill-2", name: "SQL" },
    ],
    projectRoles: [
      { id: "role-1", name: "Reviewer" },
      { id: "role-2", name: "Lead" },
    ],
  };

  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
    service.getRequirementCatalog.mockResolvedValue(catalog);
  });

  async function openRequirements(user: User) {
    const [first] = await screen.findAllByRole("button", { name: "Add requirement" });
    await user.click(first);
    return screen.findByRole("dialog");
  }

  it("offers only the skills the phase does not already require", async () => {
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRequirements(user);

    expect(await within(dialog).findByRole("checkbox", { name: "SQL" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: "Kotlin" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Skills")).toBeInTheDocument();
  });

  it("offers project roles when asked, minus the ones already required", async () => {
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRequirements(user);
    await user.selectOptions(
      await within(dialog).findByLabelText("Requirement type"),
      "PROJECT_ROLE",
    );

    expect(within(dialog).getByRole("checkbox", { name: "Lead" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: "Reviewer" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Project roles")).toBeInTheDocument();
  });

  it("will not add until something is ticked", async () => {
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRequirements(user);
    await within(dialog).findByRole("checkbox", { name: "SQL" });
    const add = within(dialog).getByRole("button", { name: "Add selected" });
    expect(add).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "SQL" }));
    expect(add).toBeEnabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "SQL" }));
    expect(add).toBeDisabled();
  });

  it("forgets the ticks when the type changes", async () => {
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRequirements(user);
    await user.click(await within(dialog).findByRole("checkbox", { name: "SQL" }));
    await user.selectOptions(within(dialog).getByLabelText("Requirement type"), "PROJECT_ROLE");

    expect(within(dialog).getByRole("button", { name: "Add selected" })).toBeDisabled();
  });

  it("adds the ticked skills to the phase", async () => {
    const user = userEvent.setup();
    service.addPhaseRequirements.mockResolvedValue({
      revision: 2,
      requirements: [
        { id: "req-1", referenceId: "skill-1", type: "SKILL", displayName: "Kotlin" },
        { id: "req-3", referenceId: "skill-2", type: "SKILL", displayName: "SQL" },
      ],
    });
    renderPage();

    const dialog = await openRequirements(user);
    await user.click(await within(dialog).findByRole("checkbox", { name: "SQL" }));
    await user.click(within(dialog).getByRole("button", { name: "Add selected" }));

    await waitFor(() =>
      expect(service.addPhaseRequirements).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", 1, [
        { referenceId: "skill-2", type: "SKILL" },
      ]),
    );
    expect(await screen.findByText("SQL")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("adds a project role", async () => {
    const user = userEvent.setup();
    service.addPhaseRequirements.mockResolvedValue({ revision: 2, requirements: [] });
    renderPage();

    const dialog = await openRequirements(user);
    await user.selectOptions(
      await within(dialog).findByLabelText("Requirement type"),
      "PROJECT_ROLE",
    );
    await user.click(within(dialog).getByRole("checkbox", { name: "Lead" }));
    await user.click(within(dialog).getByRole("button", { name: "Add selected" }));

    await waitFor(() =>
      expect(service.addPhaseRequirements).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", 1, [
        { referenceId: "role-2", type: "PROJECT_ROLE" },
      ]),
    );
  });

  it("reports choices that could not be loaded", async () => {
    const user = userEvent.setup();
    service.getRequirementCatalog.mockRejectedValue(new Error("Catalog is down"));
    renderPage();

    const dialog = await openRequirements(user);

    expect(await within(dialog).findByText("Catalog is down")).toBeInTheDocument();
  });

  it("uses a generic message when the catalog failure carries none", async () => {
    const user = userEvent.setup();
    service.getRequirementCatalog.mockRejectedValue("nope");
    renderPage();

    const dialog = await openRequirements(user);

    expect(
      await within(dialog).findByText("Requirement choices could not be loaded."),
    ).toBeInTheDocument();
  });

  it("shows a loading line while the choices arrive", async () => {
    const user = userEvent.setup();
    service.getRequirementCatalog.mockReturnValue(new Promise(() => {}));
    renderPage();

    const dialog = await openRequirements(user);

    expect(within(dialog).getByText(/Loading requirement choices/)).toBeInTheDocument();
  });

  it("reports a requirement that could not be added", async () => {
    const user = userEvent.setup();
    service.addPhaseRequirements.mockRejectedValue(new Error("Already there"));
    renderPage();

    const dialog = await openRequirements(user);
    await user.click(await within(dialog).findByRole("checkbox", { name: "SQL" }));
    await user.click(within(dialog).getByRole("button", { name: "Add selected" }));

    expect(await screen.findByText("Already there")).toBeInTheDocument();
  });

  it("uses a generic message when the add failure carries none", async () => {
    const user = userEvent.setup();
    service.addPhaseRequirements.mockRejectedValue("nope");
    renderPage();

    const dialog = await openRequirements(user);
    await user.click(await within(dialog).findByRole("checkbox", { name: "SQL" }));
    await user.click(within(dialog).getByRole("button", { name: "Add selected" }));

    expect(
      await screen.findByText("The phase requirement could not be added."),
    ).toBeInTheDocument();
  });

  it("cancels without adding", async () => {
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRequirements(user);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(service.addPhaseRequirements).not.toHaveBeenCalled();
  });

  it("removes a requirement from its chip", async () => {
    const user = userEvent.setup();
    service.deletePhaseRequirements.mockResolvedValue({ revision: 2 });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove requirement Kotlin" }));

    await waitFor(() =>
      expect(service.deletePhaseRequirements).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", 1, [
        "req-1",
      ]),
    );
    expect(toast.success).toHaveBeenCalledWith("Requirement removed");
    expect(screen.queryByText("Kotlin")).not.toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
  });

  it("reports a requirement that could not be removed", async () => {
    const user = userEvent.setup();
    service.deletePhaseRequirements.mockRejectedValue(new Error("Locked"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove requirement Kotlin" }));

    expect(await screen.findByText("Locked")).toBeInTheDocument();
    expect(screen.getByText("Kotlin")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("uses a generic message when the removal failure carries none", async () => {
    const user = userEvent.setup();
    service.deletePhaseRequirements.mockRejectedValue("nope");
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove requirement Kotlin" }));

    expect(
      await screen.findByText("The phase requirement could not be removed."),
    ).toBeInTheDocument();
  });

  it("offers a draft instead of changing requirements on a published version", async () => {
    const user = userEvent.setup();
    servePath(richPath("ACTIVE"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Remove requirement Kotlin" }));

    expect(await screen.findByText("This version is published")).toBeInTheDocument();
    expect(service.deletePhaseRequirements).not.toHaveBeenCalled();
  });
});
