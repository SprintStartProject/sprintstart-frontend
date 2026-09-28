import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "../../../../src/components/ui/Field";
import { Input } from "../../../../src/components/ui/Input";
import { Textarea } from "../../../../src/components/ui/Textarea";
import { Select } from "../../../../src/components/ui/Select";

describe("Field", () => {
  it("binds the label to the control without the caller wiring an id", () => {
    render(
      <Field label="Token name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Token name")).toBeInTheDocument();
  });

  it("uses a caller-provided controlId when one is given", () => {
    render(
      <Field label="Token name" controlId="fixed-id">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Token name")).toHaveAttribute("id", "fixed-id");
  });

  it("describes the control with its hint", () => {
    render(
      <Field label="Token" hint="Stored encrypted.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Token")).toHaveAccessibleDescription("Stored encrypted.");
  });

  it("marks the control invalid and announces the error", () => {
    render(
      <Field label="Token" error="Token is required.">
        <Input />
      </Field>,
    );
    const control = screen.getByLabelText("Token");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Token is required.");
    expect(screen.getByRole("alert")).toHaveTextContent("Token is required.");
  });

  it("describes the control with hint and error together", () => {
    render(
      <Field label="Token" hint="Stored encrypted." error="Too short.">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Token")).toHaveAccessibleDescription(
      "Stored encrypted. Too short.",
    );
  });

  it("is not invalid when there is no error", () => {
    render(
      <Field label="Token">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Token")).not.toHaveAttribute("aria-invalid");
  });

  it("passes disabled down without the caller repeating it on the control", () => {
    render(
      <Field label="Token" disabled>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Token")).toBeDisabled();
  });

  it("wires Textarea and Select the same way as Input", () => {
    const { unmount } = render(
      <Field label="Description" error="Required.">
        <Textarea />
      </Field>,
    );
    expect(screen.getByLabelText("Description")).toHaveAttribute("aria-invalid", "true");
    unmount();

    render(
      <Field label="Manager" error="Required.">
        <Select>
          <option value="">None</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("Manager")).toHaveAttribute("aria-invalid", "true");
  });

  it("marks the label optional when the field is not required", () => {
    render(
      <Field label="Nickname" optional>
        <Input />
      </Field>,
    );
    const control = screen.getByLabelText("Nickname (optional)");
    expect(control).toBeInTheDocument();
    expect(control).toHaveAccessibleName("Nickname (optional)");
  });

  it("prefers the required mark when both props are set", () => {
    render(
      <Field label="Email" required optional>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    expect(screen.queryByText("(optional)")).not.toBeInTheDocument();
  });

  it("does not mark an optional control as required", () => {
    render(
      <Field label="Nickname" optional>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Nickname (optional)")).not.toHaveAttribute("aria-required");
  });

  it("carries the field's required flag to the control as aria-required", () => {
    const { unmount: unmountInput } = render(
      <Field label="Name" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-required", "true");
    unmountInput();

    const { unmount: unmountTextarea } = render(
      <Field label="Bio" required>
        <Textarea />
      </Field>,
    );
    expect(screen.getByLabelText(/^Bio/)).toHaveAttribute("aria-required", "true");
    unmountTextarea();

    render(
      <Field label="Role" required>
        <Select>
          <option value="">None</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText(/^Role/)).toHaveAttribute("aria-required", "true");
  });

  it("keeps the HTML required attribute mirrored in aria-required", () => {
    render(<Input aria-label="Search" required />);
    expect(screen.getByLabelText("Search")).toHaveAttribute("aria-required", "true");
  });

  it("keeps the browser's own constraint validation off unless the control asks for it", () => {
    const { rerender } = render(
      <Field label="Name" required>
        <Input />
      </Field>,
    );

    // The field mark is presentation and ARIA: no native attribute, so no
    // `:required` styling and no browser "fill out this field" popup — these
    // forms gate their own submits with guards and inline errors.
    const fieldOnly = screen.getByLabelText(/^Name/);
    expect(fieldOnly).not.toHaveAttribute("required");
    expect((fieldOnly as HTMLInputElement).required).toBe(false);

    rerender(
      <Field label="Name" required>
        <Input required />
      </Field>,
    );

    const controlLevel = screen.getByLabelText(/^Name/);
    expect(controlLevel).toHaveAttribute("required");
    expect((controlLevel as HTMLInputElement).required).toBe(true);
  });

  it("lets an explicit aria-required on the control override the field", () => {
    render(
      <Field label="Name" required>
        <Input aria-required={false} />
      </Field>,
    );
    expect(screen.getByLabelText(/^Name/)).not.toHaveAttribute("aria-required");
  });
});

describe("Textarea", () => {
  it("grows by default, so no drag handle is offered", () => {
    render(<Textarea aria-label="Description" />);
    const control = screen.getByLabelText("Description");
    expect(control.className).toContain("resize-none");
    expect(control.className).not.toContain("resize-y");
  });

  it("offers a drag handle when growing is switched off", () => {
    render(<Textarea aria-label="Description" autoResize={false} />);
    expect(screen.getByLabelText("Description").className).toContain("resize-y");
  });

  it("starts at minRows", () => {
    render(<Textarea aria-label="Description" minRows={4} />);
    expect(screen.getByLabelText("Description")).toHaveAttribute("rows", "4");
  });
});

describe("Input", () => {
  it("works standalone, without a Field around it", () => {
    render(<Input aria-label="Search" placeholder="Search…" />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("keeps the leading icon out of the accessibility tree", () => {
    render(<Input aria-label="Search" icon={<svg data-testid="icon" />} />);
    expect(screen.getByTestId("icon").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("carries the shared focus ring token", () => {
    render(<Input aria-label="Search" />);
    expect(screen.getByLabelText("Search").className).toContain("focus:ring-app-focus");
  });
});
