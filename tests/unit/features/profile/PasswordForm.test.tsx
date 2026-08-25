import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordForm } from "../../../../src/features/profile/components/PasswordForm";
import { mockKeycloakInstance } from "../../setup/vitest.setup";

describe("PasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the password update card and button", () => {
    render(<PasswordForm />);
    expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("triggers Keycloak UPDATE_PASSWORD action with redirectUri pointing to /settings", async () => {
    const user = userEvent.setup();
    render(<PasswordForm />);

    const button = screen.getByRole("button", { name: /update password/i });
    await user.click(button);

    expect(mockKeycloakInstance.login).toHaveBeenCalledWith({
      action: "UPDATE_PASSWORD",
      redirectUri: `${window.location.origin}/settings`,
    });
  });
});
