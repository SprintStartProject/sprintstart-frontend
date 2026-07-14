import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { http, HttpResponse } from "msw";
import { AdminPage } from "../../../src/pages/AdminPage";
import { server } from "../setup/vitest.setup";

const adminUsers = [
  {
    id: "user-1",
    authId: "auth-1",
    username: "john.doe",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    projectRoles: [{ id: "role-dev", name: "Developer" }],
    permissionGroup: "ADMIN",
    enabled: true,
    profileIcon: null,
    hasCompletedOnboarding: true,
  },
];

describe("AdminPage Accessibility", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/v1/admin/users", () => HttpResponse.json(adminUsers)),
      http.get("/api/v1/github/pat", () => HttpResponse.json(["default"])),
    );
  });

  it("has no axe violations across admin tabs", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Projects" }));
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Search projects" }),
      ).toBeInTheDocument();
    });
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Tokens" }));
    await waitFor(() => {
      expect(screen.getByText("default")).toBeInTheDocument();
    });
    expect(await axe(baseElement)).toHaveNoViolations();
  }, 10000);
});
