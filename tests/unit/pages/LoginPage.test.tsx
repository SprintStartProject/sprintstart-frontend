import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../../../src/pages/LoginPage";

const mockLogin = vi.fn();

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ login: mockLogin, status: "authenticated" }),
}));

vi.mock("../../../src/components/common/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle light and dark mode">Theme</button>,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the SprintStart branding and sign-in button", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("SprintStart")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign in with SSO/i })).toBeInTheDocument();
  });

  it("calls login with default redirect when no parameter is present", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Sign in with SSO/i }));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith({ redirectPath: "/" });
  });

  it("calls login with the decoded redirect parameter", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/login?redirect=%2Finsights%2Ffaq%2F42%3Ftab%3D1"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Sign in with SSO/i }));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith({ redirectPath: "/insights/faq/42?tab=1" });
  });
});
