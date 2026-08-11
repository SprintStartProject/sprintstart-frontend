import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { AccountForm } from "../../../src/features/profile/components/AccountForm";
import { MemoryRouter } from "react-router-dom";

describe("AccountForm Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const mockProfile = {
      id: "123",
      username: "TestUser",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      permissionGroup: "USER",
      projectRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
          <AccountForm profile={mockProfile as any} onUpdate={vi.fn()} />
        </main>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
