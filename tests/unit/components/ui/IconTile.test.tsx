import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, it, expect } from "vitest";
import {
  IconTile,
  type IconTileSize,
  type IconTileTone,
} from "../../../../src/components/ui/IconTile";

function getTile(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

describe("IconTile", () => {
  it("is neutral and lg by default", () => {
    const { container } = render(<IconTile icon={Users} />);
    const tile = getTile(container);

    expect(tile).toHaveClass("bg-app-neutral-bg", "text-app-neutral-text");
    expect(tile).toHaveClass("h-9", "w-9", "rounded-xl");
  });

  it("gives the accent tone the brand gradient", () => {
    const { container } = render(<IconTile icon={Users} tone="accent" />);
    const tile = getTile(container);

    expect(tile).toHaveClass(
      "bg-gradient-to-br",
      "from-app-progress-fill",
      "to-app-progress-fill-end",
    );
    expect(tile).toHaveClass("text-white");
  });

  it("sets tile and icon classes for every size", () => {
    const sizes: Record<IconTileSize, { tile: string[]; icon: string[] }> = {
      sm: { tile: ["h-7", "w-7", "rounded-lg"], icon: ["h-3.5", "w-3.5"] },
      md: { tile: ["h-8", "w-8", "rounded-lg"], icon: ["h-4", "w-4"] },
      lg: { tile: ["h-9", "w-9", "rounded-xl"], icon: ["h-4", "w-4"] },
      xl: { tile: ["h-11", "w-11", "rounded-xl"], icon: ["h-5", "w-5"] },
      "2xl": { tile: ["h-14", "w-14", "rounded-2xl"], icon: ["h-6", "w-6"] },
    };

    for (const [size, expected] of Object.entries(sizes)) {
      const view = render(<IconTile icon={Users} size={size as IconTileSize} />);
      const tile = getTile(view.container);

      expect(tile).toHaveClass(...expected.tile);
      expect(tile.querySelector("svg")).toHaveClass(...expected.icon);
      view.unmount();
    }
  });

  it("renders children after the icon", () => {
    const { container } = render(
      <IconTile icon={Users}>
        <span data-testid="dot" />
      </IconTile>,
    );
    const tile = getTile(container);

    expect(screen.getByTestId("dot")).toBeInTheDocument();
    expect(tile.lastElementChild).toBe(screen.getByTestId("dot"));
    expect(tile.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("renders without an icon", () => {
    const { container } = render(
      <IconTile>
        <span data-testid="custom" />
      </IconTile>,
    );

    expect(getTile(container).querySelector("svg")).toBeNull();
    expect(screen.getByTestId("custom")).toBeInTheDocument();
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<IconTile icon={Users} />);

    expect(getTile(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("merges custom classNames", () => {
    const { container } = render(<IconTile icon={Users} className="relative" />);

    expect(getTile(container)).toHaveClass("relative");
  });

  it("takes every colour from a token, never a raw palette value", () => {
    const tones: IconTileTone[] = [
      "accent",
      "brand",
      "cyan",
      "indigo",
      "pink",
      "purple",
      "warning",
      "success",
      "danger",
      "neutral",
      "muted",
    ];

    for (const tone of tones) {
      const view = render(<IconTile icon={Users} tone={tone} />);
      const className = getTile(view.container).className;

      // No `bg-purple-50`, `text-pink-700` and friends, and no `dark:`
      // override: both themes come from the CSS variables.
      expect(className).not.toMatch(
        /\b(bg|text|border)-(slate|gray|red|orange|amber|yellow|green|emerald|blue|indigo|purple|pink|rose)-\d{2,3}\b/,
      );
      expect(className).not.toContain("dark:");
      view.unmount();
    }
  });
});
