import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { PasswordForm } from "../../../src/features/profile/components/PasswordForm";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../src/config/keycloak", () => ({
  default: {
    login: vi.fn(),
  },
}));

describe("PasswordForm Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <PasswordForm />
        </main>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
