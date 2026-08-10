import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectionCheckbox } from "../../../../../src/features/admin/components/SelectionCheckbox";

describe("SelectionCheckbox", () => {
  const defaultProps = {
    checked: false,
    onChange: vi.fn(),
    ariaLabel: "Select item",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a checkbox role with the provided aria-label", () => {
    render(<SelectionCheckbox {...defaultProps} />);
    expect(screen.getByRole("checkbox", { name: "Select item" })).toBeInTheDocument();
  });

  it("reflects aria-checked based on the checked prop", () => {
    const { rerender } = render(<SelectionCheckbox {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", { name: "Select item" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    rerender(<SelectionCheckbox {...defaultProps} checked={true} />);
    expect(screen.getByRole("checkbox", { name: "Select item" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("fires the onChange callback when clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SelectionCheckbox {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Select item" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("fires the onChange callback when activated with the Space key", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SelectionCheckbox {...defaultProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Select item" });
    checkbox.focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("shows a check indicator only when checked", () => {
    const { rerender } = render(<SelectionCheckbox {...defaultProps} checked={true} />);
    expect(screen.getByRole("checkbox").querySelector("svg")).not.toBeNull();

    rerender(<SelectionCheckbox {...defaultProps} checked={false} />);
    expect(screen.getByRole("checkbox").querySelector("svg")).toBeNull();
  });
});
