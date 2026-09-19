import { render } from "@testing-library/react";
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
});
