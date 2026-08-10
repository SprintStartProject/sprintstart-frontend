import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../../../../src/components/ui/Button";

describe("Button", () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("still allows an explicit submit type", () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Click me
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disables itself and announces busy while loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("does not announce busy when not loading", () => {
    render(<Button>Idle</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("hides the leading icon behind the spinner while loading", () => {
    const { rerender } = render(<Button icon={<span data-testid="leading-icon" />}>Save</Button>);
    expect(screen.getByTestId("leading-icon")).toBeInTheDocument();

    rerender(
      <Button loading icon={<span data-testid="leading-icon" />}>
        Save
      </Button>,
    );
    expect(screen.queryByTestId("leading-icon")).not.toBeInTheDocument();
  });

  it("keeps its accessible name from aria-label when icon-only", () => {
    render(
      <Button iconOnly aria-label="Close">
        <span aria-hidden="true">x</span>
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("carries a focus ring in every variant — the rule the component exists to enforce", () => {
    const variants = [
      "primary",
      "secondary",
      "ghost",
      "danger",
      "dangerSoft",
      "dangerGhost",
    ] as const;

    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole("button").className).toContain("focus-visible:ring-app-focus");
      unmount();
    }
  });

  it("casts the brand lift shadow only on primary", () => {
    const { unmount } = render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole("button").className).toContain("hover:shadow-app-brand-lift");
    unmount();

    for (const variant of ["secondary", "ghost", "danger"] as const) {
      const view = render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole("button").className).not.toContain("shadow-app-brand-lift");
      view.unmount();
    }
  });

  it("appends className instead of dropping the variant classes", () => {
    render(
      <Button variant="primary" className="mt-3">
        Go
      </Button>,
    );
    const className = screen.getByRole("button").className;
    expect(className).toContain("bg-app-brand");
    expect(className).toContain("mt-3");
  });

  it("forwards a ref, so callers can focus it", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current).toBe(screen.getByRole("button"));
  });
});
