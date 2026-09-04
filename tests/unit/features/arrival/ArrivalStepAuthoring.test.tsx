import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArrivalStepAuthoring } from "../../../../src/features/arrival/components/ArrivalStepAuthoring";
import { arrivalService } from "../../../../src/services/arrivalService";
import type { ArrivalStep, DerivableArrivalStep } from "../../../../src/features/arrival/types";

vi.mock("../../../../src/services/arrivalService", () => ({
  arrivalService: {
    listSteps: vi.fn(),
    listDerivableSteps: vi.fn(),
    createStep: vi.fn(),
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

describe("ArrivalStepAuthoring", () => {
  beforeEach(() => {
    vi.mocked(arrivalService.listSteps).mockReset().mockResolvedValue([step()]);
    vi.mocked(arrivalService.listDerivableSteps).mockReset().mockResolvedValue([]);
    vi.mocked(arrivalService.createStep).mockReset();
    vi.mocked(arrivalService.reorderSteps).mockReset();
    vi.mocked(arrivalService.deleteStep).mockReset();
  });

  it("states that the list does not block anyone", async () => {
    render(<ArrivalStepAuthoring />);

    // "Mandatory steps" reads like a gate, and the previous model was one. The page has to say
    // otherwise, or a PM will reasonably assume it withholds work until the list is done.
    expect(await screen.findByText(/Nothing here blocks anyone/i)).toBeInTheDocument();
  });

  it("distinguishes an empty list from a broken one", async () => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText(/No arrival steps yet/i)).toBeInTheDocument();
    // The consequence is the useful half: nobody sees the card at all until something exists.
    expect(screen.getByText(/nobody sees this card/i)).toBeInTheDocument();
  });

  it("says what survives a removal before removing it", async () => {
    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: /Remove "Request VPN access"/ }));

    // What a PM cannot guess is what is kept: state is keyed by the step key, so people's
    // records outlive the definition and re-adding the key brings them back.
    expect(screen.getByText(/Records of people who already did it are kept/i)).toBeInTheDocument();
    expect(arrivalService.deleteStep).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(arrivalService.deleteStep).toHaveBeenCalledWith("vpn", null);
    });
  });

  it("sends the whole order when a step is moved", async () => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([
      step({ key: "vpn", title: "Request VPN access" }),
      step({ key: "laptop", title: "Collect a laptop", position: 1 }),
    ]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: /Move "Collect a laptop" earlier/ }));

    // Never a from/to pair: two people reordering at once must not interleave into an order
    // neither of them chose.
    await waitFor(() => {
      expect(arrivalService.reorderSteps).toHaveBeenCalledWith(["laptop", "vpn"], null);
    });
  });

  it("warns that the key is fixed at the point of choosing one", async () => {
    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a step" }));

    expect(screen.getByText(/fixed once saved/i)).toBeInTheDocument();
  });

  it("shows the list to a read-only viewer but offers no way to change it", async () => {
    render(<ArrivalStepAuthoring readOnly />);

    // HR reads the real list rather than a notice standing in for it — they are often the
    // person who knows what it should say.
    expect(await screen.findByText("Request VPN access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a step" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove "Request VPN access"/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/a PM or an admin can/i)).toBeInTheDocument();
  });

  it("reads and writes the project scope it was given", async () => {
    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);

    await waitFor(() => {
      expect(arrivalService.listSteps).toHaveBeenCalledWith("p1");
    });
    fireEvent.click(await screen.findByRole("button", { name: /Remove "Request VPN access"/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(arrivalService.deleteStep).toHaveBeenCalledWith("vpn", "p1");
    });
  });

  /** The scope is the page's, not the form's — a form that had to remember it could disagree. */
  it("creates into the scope being authored without the form saying so", async () => {
    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a step" }));

    // By placeholder: the wrapping <label> carries its hint text too, so an exact label
    // match does not find these inputs.
    fireEvent.change(screen.getByPlaceholderText("Request VPN access"), {
      target: { value: "Get staging" },
    });
    fireEvent.change(screen.getByPlaceholderText("vpn-access"), {
      target: { value: "staging" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));

    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ key: "staging", projectId: "p1" }),
      );
    });
  });

  /**
   * A project scope explains itself differently: its steps are *extra*, and people on it still
   * get the company list. Saying "nobody sees this card at all" there would be false.
   */
  it("says a project’s empty list still leaves the company one in place", async () => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([]);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);

    expect(await screen.findByText(/still get the company-wide list/i)).toBeInTheDocument();
    expect(screen.queryByText(/nobody sees this card/i)).not.toBeInTheDocument();
  });

  /**
   * A derivation is code bound to one key, so a checkable step is the same step everywhere and
   * belongs on the list everybody gets. In a project scope the catalog's `added` flags describe
   * the *company* list, so it would advertise as available something already added.
   */
  it("offers the derivable catalog only on the company-wide list", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring projectId="p1" projectName="Apollo" />);

    expect(await screen.findByText("Request VPN access")).toBeInTheDocument();
    expect(screen.queryByText("Add your GitHub username")).not.toBeInTheDocument();
  });

  /**
   * Without this the only way to add a derived step is to know that typing `github-account` into
   * the ordinary form happens to be magic — which is exactly the folklore the catalog replaces.
   */
  it("offers the steps the system can check, with their wording", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText("Add your GitHub username")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("adds a derivable step under its own key", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));

    // The key is what binds the row to its derivation, so it is the one thing not up for edit.
    await waitFor(() => {
      expect(arrivalService.createStep).toHaveBeenCalledWith(
        expect.objectContaining({ key: "github-account" }),
      );
    });
  });

  /**
   * `selfConfirmable` is not a synonym for "not derived", and the author is the person who has to
   * understand why one checkable step can still be ticked and another cannot.
   */
  it("says up front whether the hire can also claim a checkable step", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([
      derivable({ selfConfirmable: false }),
    ]);

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText(/the hire cannot mark it done/i)).toBeInTheDocument();
  });

  it("does not offer to add a step already on the list", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable({ added: true })]);

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText("On the list")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("shows a read-only viewer the catalog without a way to act on it", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockResolvedValue([derivable()]);

    render(<ArrivalStepAuthoring readOnly />);

    expect(await screen.findByText("Add your GitHub username")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  /**
   * The authored list is the page; the catalog is an offer on top of it. One failing must not
   * take the other down.
   */
  it("still shows the list when the catalog cannot be loaded", async () => {
    vi.mocked(arrivalService.listDerivableSteps).mockRejectedValue(new Error("nope"));

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText("Request VPN access")).toBeInTheDocument();
  });

  it("marks which authored steps the system checks", async () => {
    vi.mocked(arrivalService.listSteps).mockResolvedValue([
      step({
        key: "github-account",
        title: "Add your GitHub username",
        settledBy: "OBSERVED",
        selfConfirmable: false,
      }),
    ]);

    render(<ArrivalStepAuthoring />);

    expect(await screen.findByText(/We check this one/i)).toBeInTheDocument();
  });
});
