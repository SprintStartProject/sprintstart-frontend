import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { AccountEnabledToggle } from "../../../src/features/admin/components/AccountEnabledToggle";

describe("AccountEnabledToggle Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <AccountEnabledToggle enabled={false} disabled={false} onChange={vi.fn()} />
        </main>
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: "Toggle account access" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
