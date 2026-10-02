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

// One stable object, as the real hook hands out: the component feeds `toast.error` into an effect.
const toastSpies = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../../../../src/context/useToast", () => ({
  useToast: () => toastSpies,
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
    toastSpies.success.mockReset();
    toastSpies.error.mockReset();
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

  /** Opens the "Add step" modal and moves on to the custom form. The suggestions are listed
   * right away, with "Custom" as the last entry — picking it advances, there is no "Next". */
  async function openAddWizard(kind: "Suggested" | "Custom") {
    fireEvent.click(await screen.findByRole("button", { name: "Add step" }));
    const dialog = await screen.findByRole("dialog");
    if (kind === "Custom") {
      fireEvent.click(await within(dialog).findByRole("button", { name: /^Custom/ }));
    }
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

  it("refuses a custom key that the target list already holds", async () => {
    mockLists([step({ key: "vpn", title: "Request VPN access" })], []);

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Custom");

    fireEvent.change(within(dialog).getByPlaceholderText("Request VPN access"), {
      target: { value: "Request VPN access again" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("vpn-access"), {
      target: { value: "vpn" },
    });

    expect(
      within(dialog).getByText("A step with this key is already on that list."),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));
    expect(arrivalService.createStep).not.toHaveBeenCalled();
  });

  it("still allows a project step that reuses a company key, since that is an override", async () => {
    mockLists([step({ key: "vpn", title: "Request VPN access" })], []);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    const dialog = await openAddWizard("Custom");

    fireEvent.change(within(dialog).getByPlaceholderText("Request VPN access"), {
      target: { value: "Request VPN access with the staging profile" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("vpn-access"), {
      target: { value: "vpn" },
    });

    expect(
      within(dialog).queryByText("A step with this key is already on that list."),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ key: "vpn", projectId: "p1" }),
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

    const addButton = within(dialog).getByRole("button", { name: "Add step" });
    expect(addButton).toBeDisabled();
    fireEvent.click(
      await within(dialog).findByRole("button", { name: /Add your GitHub username/ }),
    );
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ key: "github-account", projectId: null }),
      );
    });
  });

  it("adds several suggestions in one go", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([
      derivable(),
      derivable({ key: "slack-account", suggestedTitle: "Join Slack" }),
    ]);

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Suggested");

    const github = await within(dialog).findByRole("button", { name: /Add your GitHub username/ });
    const slack = within(dialog).getByRole("button", { name: /Join Slack/ });
    fireEvent.click(github);
    fireEvent.click(slack);
    expect(github).toHaveAttribute("aria-pressed", "true");
    expect(slack).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: "Add 2 steps" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledTimes(2);
    });
    expect(arrivalService.createStep).toHaveBeenCalledWith(
      expect.objectContaining({ key: "github-account" }),
    );
    expect(arrivalService.createStep).toHaveBeenCalledWith(
      expect.objectContaining({ key: "slack-account" }),
    );
  });

  it("deselects a suggestion on a second click", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Suggested");

    const github = await within(dialog).findByRole("button", { name: /Add your GitHub username/ });
    fireEvent.click(github);
    fireEvent.click(github);

    expect(github).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByRole("button", { name: "Add step" })).toBeDisabled();
  });

  it("separates Custom from the suggestions with a divider", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: "Add step" }));

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("button", { name: /Add your GitHub username/ });
    expect(within(dialog).getByRole("separator")).toBeInTheDocument();
  });

  it("lists the suggestions up front with Custom as the extra last entry", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: "Add step" }));

    const dialog = await screen.findByRole("dialog");
    const suggestion = await within(dialog).findByRole("button", {
      name: /Add your GitHub username/,
    });
    const custom = within(dialog).getByRole("button", { name: /^Custom/ });

    expect(suggestion.compareDocumentPosition(custom) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(within(dialog).queryByPlaceholderText("Request VPN access")).not.toBeInTheDocument();
  });

  it("returns from the custom form to the suggestions", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Custom");

    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));

    expect(
      await within(dialog).findByRole("button", { name: /Add your GitHub username/ }),
    ).toBeInTheDocument();
  });

  it("disables suggestions already on the list but keeps Custom available", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable({ added: true })]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: "Add step" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("All suggestions are already on the list."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Add your GitHub username/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /^Custom/ })).toBeEnabled();
  });

  it("stops at the first refused suggestion and keeps the rest selected", async () => {
    const github = derivable();
    const slack = derivable({ key: "slack-account", suggestedTitle: "Join Slack" });
    const notion = derivable({ key: "notion-account", suggestedTitle: "Join Notion" });
    // The first load, then the silent reload after the one write that lands: GitHub is now on
    // the list. There is no reload after the refused write.
    vi.mocked(arrivalService.listDerivableSteps)
      .mockResolvedValueOnce([github, slack, notion])
      .mockResolvedValue([{ ...github, added: true }, slack, notion]);
    vi.mocked(arrivalService.createStep)
      .mockResolvedValueOnce(step({ key: "github-account" }))
      .mockRejectedValueOnce(new Error("409"));

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Suggested");

    fireEvent.click(
      await within(dialog).findByRole("button", { name: /Add your GitHub username/ }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /Join Slack/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Join Notion/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 3 steps" }));

    await waitFor(() => {
      expect(toastSpies.error).toHaveBeenCalledWith("That didn't save", {
        description: "That step could not be added. It may already be on the list.",
      });
    });

    expect(arrivalService.createStep).toHaveBeenCalledTimes(2);
    expect(arrivalService.createStep).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: "notion-account" }),
    );
    // Only the one that landed is announced.
    expect(toastSpies.success).toHaveBeenCalledTimes(1);
    expect(toastSpies.success).toHaveBeenCalledWith("Step added");

    // The modal stays open: the landed one is on the list, the refused and the untried are still
    // picked, so a retry is one click.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Add your GitHub username/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /Join Slack/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: /Join Notion/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await within(dialog).findByRole("button", { name: "Add 2 steps" })).toBeEnabled();
  });

  it("counts the steps in the confirmation when a whole batch lands", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([
      derivable(),
      derivable({ key: "slack-account", suggestedTitle: "Join Slack" }),
    ]);
    vi.mocked(arrivalService.createStep).mockResolvedValue(step());

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Suggested");

    fireEvent.click(
      await within(dialog).findByRole("button", { name: /Add your GitHub username/ }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /Join Slack/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 2 steps" }));

    await waitFor(() => {
      expect(toastSpies.success).toHaveBeenCalledWith("2 steps added");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("locks the suggestions and Custom while a batch is being written", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);
    vi.mocked(arrivalService.createStep).mockReturnValue(new Promise(() => {}));

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Suggested");

    const github = await within(dialog).findByRole("button", { name: /Add your GitHub username/ });
    fireEvent.click(github);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(github).toBeDisabled();
    });
    expect(within(dialog).getByRole("button", { name: /^Custom/ })).toBeDisabled();
  });

  it("moves focus into the new screen when switching between the list and Custom", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    const dialog = await openAddWizard("Custom");
    const body = within(dialog).getByTestId("add-arrival-step-body");

    await within(dialog).findByPlaceholderText("Request VPN access");
    await waitFor(() => {
      expect(body).toHaveFocus();
    });

    // Focus is somewhere else again by the time the user goes back.
    within(dialog).getByPlaceholderText("Request VPN access").focus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    await within(dialog).findByRole("button", { name: /Add your GitHub username/ });

    await waitFor(() => {
      expect(body).toHaveFocus();
    });
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
