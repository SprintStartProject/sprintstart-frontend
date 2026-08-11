import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveButton } from "../../../../src/components/ui/SaveButton";

describe("SaveButton", () => {
  it("is disabled and muted when there are no unsaved changes", () => {
    render(<SaveButton dirty={false} saving={false} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Saved");
  });

  it("is enabled and highlighted when there are unsaved changes", async () => {
    const onClick = vi.fn();
    render(<SaveButton dirty saving={false} onClick={onClick} />);
    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Save changes");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows a saving label and disables while saving", () => {
    render(<SaveButton dirty saving />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Saving…");
  });

  it("honours an extra disabled reason even when dirty", () => {
    render(<SaveButton dirty saving={false} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
