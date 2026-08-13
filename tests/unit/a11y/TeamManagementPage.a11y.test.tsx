import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { TeamManagementPage } from "../../../src/pages/TeamManagementPage";

describe("TeamManagementPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <TeamManagementPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("combobox", { name: "Filter team members by role" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort team members" })).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
