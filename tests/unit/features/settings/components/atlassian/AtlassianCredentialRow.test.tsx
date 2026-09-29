import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AtlassianCredentialRow } from "../../../../../../src/features/settings/components/atlassian/AtlassianCredentialRow.tsx";

const credential = { userEmail: "ada@example.com", displayName: "work" };

describe("AtlassianCredentialRow field marks", () => {
  it("marks the rename field as required", async () => {
    const user = userEvent.setup();
    render(<AtlassianCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByRole("button", { name: /rename credential/i }));

    expect(screen.getByLabelText(/^New name/)).toHaveAttribute("aria-required", "true");
    // The visual half of the same fact: both credential forms are gated by a
    // `required` input, so their labels have to say so too.
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("marks the rotate field as required", async () => {
    const user = userEvent.setup();
    render(<AtlassianCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByRole("button", { name: /rotate token/i }));

    expect(screen.getByLabelText(/^New API token/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
