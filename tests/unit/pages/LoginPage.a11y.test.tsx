import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../../../src/pages/LoginPage";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ login: vi.fn(), status: "authenticated" }),
}));

vi.mock("../../../src/components/common/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle light and dark mode">Theme</button>,
}));

describe("LoginPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <LoginPage />
        </main>
      </MemoryRouter>,
    );

    expect(screen.getByText("SprintStart")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
