import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChatPreferencesProvider } from "../../../../src/context/ChatPreferencesProvider";
import { ChatSection } from "../../../../src/features/settings/components/ChatSection";

function renderWithProvider() {
  return render(
    <MemoryRouter>
      <ChatPreferencesProvider>
        <ChatSection />
      </ChatPreferencesProvider>
    </MemoryRouter>,
  );
}

describe("ChatSection — Thought Process toggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to on (checked)", () => {
    renderWithProvider();

    expect(screen.getByTestId("chat-thought-process-toggle")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("persists the preference to localStorage when toggled off", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByTestId("chat-thought-process-toggle"));

    expect(screen.getByTestId("chat-thought-process-toggle")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(window.localStorage.getItem("chatPreferences.showThoughtProcess")).toBe("false");
  });

  it("reads the stored preference on mount", () => {
    window.localStorage.setItem("chatPreferences.showThoughtProcess", "false");

    renderWithProvider();

    expect(screen.getByTestId("chat-thought-process-toggle")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
