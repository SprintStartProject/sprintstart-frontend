import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArrivalStepAuthoring } from "../../../../src/features/arrival/components/ArrivalStepAuthoring";
import { arrivalService } from "../../../../src/services/arrivalService";
import type { ArrivalStep, DerivableArrivalStep } from "../../../../src/features/arrival/types";

vi.mock("../../../../src/services/arrivalService", () => ({
  arrivalService: {
    listSteps: vi.fn(),
    listDerivableSteps: vi.fn(),
    createStep: vi.fn(),
    updateStep: vi.fn(),
    reorderSteps: vi.fn(),
    deleteStep: vi.fn(),
  },
}));

const step = (over: Partial<ArrivalStep> = {}): ArrivalStep => ({
  key: "vpn",
  projectId: null,
  projectName: null,
  title: "Request VPN access",
  description: null,
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
  ...over,
});

const derivable = (over: Partial<DerivableArrivalStep> = {}): DerivableArrivalStep => ({
  key: "github-account",
  suggestedTitle: "Add your GitHub username",
  suggestedDescription: "So work you push can be recognised as yours.",
  selfConfirmable: false,
  added: false,
  ...over,
});

/** Routes `listSteps` the way the real backend does: `null`/no id is company-wide. */
function mockLists(company: ArrivalStep[], project: ArrivalStep[] = []) {
  vi.mocked(arrivalService.listSteps).mockImplementation((projectId) =>
    Promise.resolve(projectId ? project : company),
  );
}

describe("ArrivalStepAuthoring", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockReset();
    vi.mocked(arrivalService.listDerivableSteps).mockReset().mockResolvedValue([]);
    vi.mocked(arrivalService.createStep).mockReset();
    vi.mocked(arrivalService.updateStep).mockReset();
    vi.mocked(arrivalService.reorderSteps).mockReset();
    vi.mocked(arrivalService.deleteStep).mockReset();
    mockLists([step()]);
  });

  it("shows just the steps, with no section marks, without a project in context", async () => {
    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText("Request VPN access")).toBeInTheDocument();
    // Nothing to mark a company step against without a second list, so no section labels either.
    expect(screen.queryByText("For everyone")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Which list to show" })).not.toBeInTheDocument();
    expect(arrivalService.listSteps).toHaveBeenCalledTimes(1);
    expect(arrivalService.listSteps).toHaveBeenCalledWith(null);
  });

  it("shows both sections with marks when a project is in context", async () => {
    mockLists(
      [step({ key: "vpn", title: "Request VPN access" })],
      [step({ key: "staging-db", title: "Get staging DB access", projectId: "p1" })],
    );

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);

    expect(await screen.findByText("For everyone")).toBeInTheDocument();
    expect(await screen.findByText("Only in Apollo")).toBeInTheDocument();
    expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    expect(screen.getByText("Get staging DB access")).toBeInTheDocument();
    expect(arrivalService.listSteps).toHaveBeenCalledWith(null);
    expect(arrivalService.listSteps).toHaveBeenCalledWith("p1");
  });

  it("shows a subdued line instead of a mark when the project has nothing of its own", async () => {
    mockLists([step({ key: "vpn" })], []);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);

    expect(await screen.findByText("Nothing extra for Apollo yet")).toBeInTheDocument();
    expect(screen.queryByText("Only in Apollo")).not.toBeInTheDocument();
  });

  it("marks a company step that a project overrides, without touching its controls", async () => {
    mockLists(
      [step({ key: "vpn", title: "Request VPN access" })],
      [step({ key: "vpn", title: "Request VPN access with the staging profile", projectId: "p1" })],
    );

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    await screen.findByText("Request VPN access with the staging profile");

    expect(screen.getByText("Overridden")).toBeInTheDocument();
    // A shadowed company row cannot be reordered — the project's own version is what matters here.
    expect(
      screen.queryByRole("button", { name: /Move "Request VPN access" earlier/ }),
    ).not.toBeInTheDocument();
  });

  it("marks a project step that overrides the company wording", async () => {
    mockLists(
      [step({ key: "vpn", title: "Request VPN access" })],
      [step({ key: "vpn", title: "Request VPN access with the staging profile", projectId: "p1" })],
    );

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    await screen.findByText("Request VPN access with the staging profile");

    expect(screen.getByText("Override")).toBeInTheDocument();
  });

  it("says what survives a removal before removing it", async () => {
    render(<ArrivalStepAuthoring />);

    fireEvent.click(await screen.findByRole("button", { name: /Edit "Request VPN access"/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove step" }));

    expect(screen.getByText(/Records of people who already did it are kept/i)).toBeInTheDocument();
    expect(arrivalService.deleteStep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(arrivalService.deleteStep).toHaveBeenCalledWith("vpn", null);
    });
  });

  it("removes a project-scoped step with that scope's id", async () => {
    mockLists(
      [step({ key: "vpn" })],
      [step({ key: "staging-db", title: "Get staging DB access", projectId: "p1" })],
    );

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    fireEvent.click(await screen.findByRole("button", { name: /Edit "Get staging DB access"/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove step" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(arrivalService.deleteStep).toHaveBeenCalledWith("staging-db", "p1");
    });
  });

  it("sends the whole scope's order when a step is moved", async () => {
    mockLists([
      step({ key: "vpn", title: "Request VPN access" }),
      step({ key: "laptop", title: "Collect a laptop", position: 1 }),
    ]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: /Move "Collect a laptop" earlier/ }));

    await waitFor(() => {
      expect(arrivalService.reorderSteps).toHaveBeenCalledWith(["laptop", "vpn"], null);
    });
  });

  it("shows the list to a read-only viewer but offers no way to change it", async () => {
    render(<ArrivalStepAuthoring readOnly />);

    expect(await screen.findByText("Request VPN access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add step" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit "Request VPN access"/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Only PMs and admins can change this list.")).toBeInTheDocument();
  });

  /** Opens the "Add step" wizard and advances past the Kind step — picking a kind now advances
   * immediately, there is no separate "Next" click. */
  async function openAddWizard(kind: "Suggested" | "Custom") {
    fireEvent.click(await screen.findByRole("button", { name: "Add step" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: new RegExp(`^${kind}`) }));
    return dialog;
  }

  it("creates into the company scope by default without a project in context", async () => {
    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Custom");

    fireEvent.change(within(dialog).getByPlaceholderText("Request VPN access"), {
      target: { value: "Collect a laptop" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "collect-a-laptop",
          title: "Collect a laptop",
          projectId: null,
        }),
      );
    });
  });

  it("derives the key from the title, editable under Advanced", async () => {
    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Custom");

    fireEvent.change(within(dialog).getByPlaceholderText("Request VPN access"), {
      target: { value: "Get staging DB access" },
    });
    fireEvent.click(within(dialog).getByText("Advanced"));
    expect(within(dialog).getByPlaceholderText("vpn-access")).toHaveValue("get-staging-db-access");

    fireEvent.change(within(dialog).getByPlaceholderText("vpn-access"), {
      target: { value: "staging-db" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ key: "staging-db" }),
      );
    });
  });

  it("offers who gets a new step only when a project is in context, defaulting to that project", async () => {
    mockLists([step({ key: "vpn" })], []);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    const dialog = await openAddWizard("Custom");

    fireEvent.change(within(dialog).getByPlaceholderText("Request VPN access"), {
      target: { value: "Read the ADRs" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "p1" }),
      );
    });
  });

  it("creates for everyone when 'Everyone' is picked in the add form", async () => {
    mockLists([step({ key: "vpn" })], []);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    const dialog = await openAddWizard("Custom");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Everyone$/ }));

    fireEvent.change(within(dialog).getByPlaceholderText("Request VPN access"), {
      target: { value: "Join #eng-help" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: null }),
      );
    });
  });

  it("edits a company step's wording directly outside a project view", async () => {
    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: /Edit "Request VPN access"/ }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Request VPN access"), {
      target: { value: "Request VPN access from IT" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(arrivalService.updateStep).toHaveBeenCalledWith(
        "vpn",
        expect.objectContaining({ title: "Request VPN access from IT" }),
        null,
      );
    });
  });

  it("asks everyone vs only this project when editing a not-yet-overridden company step from a project view", async () => {
    mockLists([step({ key: "vpn", title: "Request VPN access" })], []);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    fireEvent.click(await screen.findByRole("button", { name: /Edit "Request VPN access"/ }));

    expect(
      screen.getByText(/Everyone gets this step\. Where should your change apply\?/i),
    ).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Request VPN access"), {
      target: { value: "Request VPN access with the staging profile" },
    });
    // Defaults to "only this project" — the reader is looking at Apollo's list.
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "vpn",
          projectId: "p1",
          title: "Request VPN access with the staging profile",
        }),
      );
    });
    expect(arrivalService.updateStep).not.toHaveBeenCalled();
  });

  it("saves an already-replaced company step's wording without asking again", async () => {
    mockLists(
      [step({ key: "vpn", title: "Request VPN access" })],
      [step({ key: "vpn", title: "Request VPN access with the staging profile", projectId: "p1" })],
    );

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    await screen.findByText("Overridden");
    fireEvent.click(screen.getByRole("button", { name: /Edit "Request VPN access"/ }));

    expect(
      screen.queryByText(/Everyone gets this step\. Where should your change apply\?/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/see their own version of this step/i)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(arrivalService.updateStep).toHaveBeenCalledWith("vpn", expect.any(Object), null);
    });
  });

  it("reverts an override back to the company wording", async () => {
    mockLists(
      [step({ key: "vpn", title: "Request VPN access" })],
      [step({ key: "vpn", title: "Request VPN access with the staging profile", projectId: "p1" })],
    );

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Edit "Request VPN access with the staging profile"/,
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Replaces the company wording/i)).toBeInTheDocument();
    // The override can only be reverted, never deleted outright — deleting the company step is
    // what "Remove step" is for, and that button does not apply to an override row.
    expect(within(dialog).queryByRole("button", { name: "Remove step" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Use the company wording again" }));

    await waitFor(() => {
      expect(arrivalService.deleteStep).toHaveBeenCalledWith("vpn", "p1");
    });
  });

  it("adds a suggested step through the wizard", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Suggested");

    fireEvent.click(within(dialog).getByRole("button", { name: /Add your GitHub username/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ key: "github-account", projectId: null }),
      );
    });
  });

  it("disables the Suggested card once every suggestion is already on the list", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable({ added: true })]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: "Add step" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("All suggestions are already on the list"),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^Suggested/ })).toBeDisabled();
  });

  it("still shows the lists when the catalog cannot be loaded", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockRejectedValue(new Error("nope"));

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText("Request VPN access")).toBeInTheDocument();
  });

  it("distinguishes an empty company list from a broken one", async () => {
    mockLists([]);

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText("No steps here yet.")).toBeInTheDocument();
  });
});
