import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PendingAttestations } from "../../../../src/features/attestation/components/PendingAttestations";
import type { Attestation } from "../../../../src/features/attestation/types";

const attestation = (over: Partial<Attestation> = {}): Attestation => ({
  id: "a1",
  hireId: "h1",
  hireName: "Sam Hire",
  projectId: "p1",
  title: "Facilitated the sprint retro",
  evidenceUrl: null,
  attesterId: "u2",
  attesterName: "Alex PO",
  state: "REQUESTED",
  requestedAt: "2026-07-25T09:00:00Z",
  firstResponseAt: null,
  acceptedAt: null,
  returnedCount: 0,
  returnReason: null,
  ...over,
});

function renderQueue(over: Partial<Parameters<typeof PendingAttestations>[0]> = {}) {
  const props = {
    pending: [attestation()],
    loading: false,
    error: false,
    answeringId: null,
    answerError: null,
    accept: vi.fn().mockResolvedValue(undefined),
    sendBack: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  const view = render(<PendingAttestations {...props} />);
  return { ...props, ...view };
}

describe("PendingAttestations", () => {
  it("names the work and who asked", () => {
    renderQueue();

    expect(screen.getByText("Facilitated the sprint retro")).toBeInTheDocument();
    expect(screen.getByText(/Asked by Sam Hire/)).toBeInTheDocument();
  });

  it("renders nothing when nobody is waiting on you", () => {
    const { container } = renderQueue({ pending: [] });

    // An empty box would imply this person is neglecting something they are not.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while still loading", () => {
    const { container } = renderQueue({ loading: true, pending: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it("confirms the work", () => {
    const { accept } = renderQueue();

    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));

    expect(accept).toHaveBeenCalledWith("a1");
  });

  it("will not send work back without a reason", () => {
    renderQueue();

    fireEvent.click(screen.getByRole("button", { name: /Send back/i }));

    // "No, and I won't say why" is not something the hire can act on.
    expect(screen.getByRole("button", { name: /Send it back/i })).toBeDisabled();
  });

  it("sends the work back with the reason typed", () => {
    const { sendBack } = renderQueue();

    fireEvent.click(screen.getByRole("button", { name: /Send back/i }));
    fireEvent.change(screen.getByLabelText(/What needs to change/i), {
      target: { value: "  The actions were never written down  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send it back/i }));

    expect(sendBack).toHaveBeenCalledWith("a1", "The actions were never written down");
  });

  it("says how many times work has already been sent back", () => {
    renderQueue({ pending: [attestation({ returnedCount: 2 })] });

    // Rework is what the autonomy milestone reads; hiding it here would flatter the record.
    expect(screen.getByText(/sent back 2 times already/i)).toBeInTheDocument();
  });

  it("surfaces a failed answer without pretending it worked", () => {
    renderQueue({ answerError: "Could not confirm that. Try again in a moment." });

    expect(screen.getByText(/Could not confirm that/i)).toBeInTheDocument();
    expect(screen.getByText("Facilitated the sprint retro")).toBeInTheDocument();
  });
});
