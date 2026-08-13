import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../../../../src/components/ui/Badge";

describe("Badge", () => {
  it("renders children correctly", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies the brand variant by default", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-app-brand-soft");
  });

  it("applies the correct classes for the danger variant", () => {
    render(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText("Danger")).toHaveClass("bg-app-danger-bg");
  });

  it("merges custom classNames", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("custom-class");
  });

  it("takes every colour from a token, never a raw palette value", () => {
    const variants = [
      "success",
      "brand",
      "warning",
      "neutral",
      "danger",
      "purple",
      "orange",
    ] as const;

    for (const variant of variants) {
      const view = render(<Badge variant={variant}>{variant}</Badge>);
      const className = screen.getByText(variant).className;

      // No `bg-purple-50`, `text-pink-700` and friends, and no `dark:`
      // override — both themes come from the CSS variables.
      expect(className).not.toMatch(
        /\b(bg|text|border)-(slate|gray|red|orange|amber|yellow|green|emerald|blue|indigo|purple|pink|rose)-\d{2,3}\b/,
      );
      expect(className).not.toContain("dark:");
      view.unmount();
    }
  });

  it("offers a smaller pill for dense rows", () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small")).toHaveClass("px-2");

    rerender(<Badge size="md">Small</Badge>);
    expect(screen.getByText("Small")).toHaveClass("px-3");
  });
});
