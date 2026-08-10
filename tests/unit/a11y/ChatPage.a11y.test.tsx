import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "../../../src/pages/ChatPage";
import { ChatProvider } from "../../../src/context/ChatProvider";

window.HTMLElement.prototype.scrollIntoView = function () {};

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "user1", firstName: "Test", username: "Test", email: "test@test.com" },
    status: "authenticated",
  }),
}));

vi.mock("../../../src/context/useChatPreferences", () => ({
  useChatPreferences: () => ({
    showThoughtProcess: true,
    setShowThoughtProcess: vi.fn(),
  }),
}));

describe("ChatPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <ChatProvider>
          <main>
            <ChatPage />
          </main>
        </ChatProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
