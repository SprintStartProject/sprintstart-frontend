import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AppearanceSection } from "../../../../src/features/settings/components/AppearanceSection";

function setSystemPrefersDark(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AppearanceSection />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AppearanceSection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    setSystemPrefersDark(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders three options (light, system, dark) with text labels", () => {
    renderWithProviders();

    expect(screen.getByTestId("theme-option-light")).toHaveTextContent("Light");
    expect(screen.getByTestId("theme-option-system")).toHaveTextContent("System");
    expect(screen.getByTestId("theme-option-dark")).toHaveTextContent("Dark");
  });

  it("persists the selected theme to localStorage and applies the dark class", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByTestId("theme-option-dark"));

    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("marks the active option as selected", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByTestId("theme-option-system"));

    expect(screen.getByTestId("theme-option-system")).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem("theme")).toBe("system");
  });

  it("applies the system preference when System is selected", async () => {
    setSystemPrefersDark(true);
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByTestId("theme-option-system"));

    expect(window.localStorage.getItem("theme")).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
