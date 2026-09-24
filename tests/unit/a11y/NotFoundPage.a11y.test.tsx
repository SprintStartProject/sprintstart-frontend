import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "../../../src/pages/NotFoundPage";

// Keep the page hermetic: the egg modal (and its lazy game chunks) must not
// load in an accessibility scan.
vi.mock("../../../src/features/easter-eggs/components/EggModalShell", () => ({
  EggModalShell: () => null,
}));

describe("NotFoundPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <NotFoundPage />
        </main>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("keeps the teaser's visible words at the start of its accessible name (WCAG 2.5.3)", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    const teaser = screen.getByRole("button", { name: /space invaders/i });
    // Normalise the ellipsis/whitespace the same way a speech recogniser would
    // hear it: the name must begin with what is drawn on screen.
    const visible = (teaser.textContent ?? "").split(" play Space Invaders")[0].trim();
    expect(visible).toBe("While you're lost in space…");
    expect(teaser).toHaveAccessibleName(expect.stringMatching(/^While you're lost in space…/));
  });
});
