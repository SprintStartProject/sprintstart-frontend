import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChatComposer } from "../../../../../src/features/chatbot/components/ChatComposer";
import type { SourceSystem } from "../../../../../src/features/chatbot/types";

describe("ChatComposer filter interactions", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn((e: React.FormEvent) => {
      e.preventDefault();
    }),
    onStop: vi.fn(),
    isBusy: false,
    hasProject: true,
    promptHistory: [],
    availableSources: ["GITHUB", "JIRA", "UPLOAD"] as SourceSystem[],
    sourcesLoading: false,
    textareaRef: createRef<HTMLTextAreaElement>(),
    showFilters: false,
    onToggleFilters: vi.fn(),
    from: "",
    setFrom: vi.fn(),
    to: "",
    setTo: vi.fn(),
    sourceSystems: [] as SourceSystem[],
    toggleSourceSystem: vi.fn(),
    activeFilterCount: 0,
    clearFilters: vi.fn(),
  };

  it("renders the filter toggle button with badge when filters are active", () => {
    const { rerender } = render(<ChatComposer {...defaultProps} />);

    const toggle = screen.getByTestId("chat-filters-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("2")).not.toBeInTheDocument();

    rerender(<ChatComposer {...defaultProps} activeFilterCount={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onToggleFilters when clicking the filter toggle button", async () => {
    const onToggleFilters = vi.fn();
    const user = userEvent.setup();

    render(<ChatComposer {...defaultProps} onToggleFilters={onToggleFilters} />);

    await user.click(screen.getByTestId("chat-filters-toggle"));
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
  });

  it("renders the active filter chips strip when activeFilterCount > 0", async () => {
    const toggleSourceSystem = vi.fn();
    const setFrom = vi.fn();
    const setTo = vi.fn();
    const clearFilters = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatComposer
        {...defaultProps}
        activeFilterCount={2}
        sourceSystems={["GITHUB"]}
        from="2026-09-01"
        to="2026-09-10"
        toggleSourceSystem={toggleSourceSystem}
        setFrom={setFrom}
        setTo={setTo}
        clearFilters={clearFilters}
      />,
    );

    // Active strip indicator
    expect(screen.getByText("Filtering:")).toBeInTheDocument();

    // Source chip
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    const removeGithub = screen.getByRole("button", { name: "Remove GitHub filter" });
    await user.click(removeGithub);
    expect(toggleSourceSystem).toHaveBeenCalledWith("GITHUB");

    // Date chip
    expect(screen.getByText("2026-09-01 → 2026-09-10")).toBeInTheDocument();
    const removeDate = screen.getByRole("button", { name: "Clear date filter" });
    await user.click(removeDate);
    expect(setFrom).toHaveBeenCalledWith("");
    expect(setTo).toHaveBeenCalledWith("");

    // Clear all button
    const clearAll = screen.getByText("Clear all");
    await user.click(clearAll);
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it("renders floating popover when showFilters is true", async () => {
    const toggleSourceSystem = vi.fn();
    const setFrom = vi.fn();
    const setTo = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatComposer
        {...defaultProps}
        showFilters={true}
        sourceSystems={["GITHUB"]}
        toggleSourceSystem={toggleSourceSystem}
        setFrom={setFrom}
        setTo={setTo}
      />,
    );

    expect(screen.getByText("Filter Knowledge Sources")).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    // Available sources rendered
    const githubBtn = screen.getByRole("button", { name: /github/i });
    expect(githubBtn).toBeInTheDocument();
    expect(githubBtn).toHaveAttribute("aria-pressed", "true");

    const jiraBtn = screen.getByRole("button", { name: /jira/i });
    expect(jiraBtn).toBeInTheDocument();
    expect(jiraBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(jiraBtn);
    expect(toggleSourceSystem).toHaveBeenCalledWith("JIRA");

    // Date presets
    const allTimeBtn = screen.getByRole("button", { name: "All time" });
    expect(allTimeBtn).toHaveAttribute("aria-pressed", "true");

    const past7Btn = screen.getByRole("button", { name: "Past 7 days" });
    expect(past7Btn).toHaveAttribute("aria-pressed", "false");

    await user.click(past7Btn);
    expect(setFrom).toHaveBeenCalled();
    expect(setTo).toHaveBeenCalled();

    await user.click(allTimeBtn);
    expect(setFrom).toHaveBeenCalledWith("");
    expect(setTo).toHaveBeenCalledWith("");
  });

  it("does not highlight presets when a 7-day range is historical and does not end today", () => {
    render(<ChatComposer {...defaultProps} showFilters={true} from="2026-01-01" to="2026-01-08" />);

    const past7Btn = screen.getByRole("button", { name: "Past 7 days" });
    expect(past7Btn).toHaveAttribute("aria-pressed", "false");

    const allTimeBtn = screen.getByRole("button", { name: "All time" });
    expect(allTimeBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("prevents form submission when Enter is pressed inside date inputs", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    render(
      <ChatComposer
        {...defaultProps}
        value="Draft message"
        showFilters={true}
        onSubmit={onSubmit}
      />,
    );

    const fromInput = screen.getByLabelText("Earliest date");
    const toInput = screen.getByLabelText("Latest date");

    fireEvent.keyDown(fromInput, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(toInput, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows keyboard activation on preset buttons with Enter", async () => {
    const setPastDaysFn = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatComposer
        {...defaultProps}
        showFilters={true}
        setFrom={setPastDaysFn}
        setTo={setPastDaysFn}
      />,
    );

    const past7Btn = screen.getByRole("button", { name: "Past 7 days" });
    past7Btn.focus();
    await user.keyboard("{Enter}");

    expect(setPastDaysFn).toHaveBeenCalled();
  });

  it("updates custom date range inputs in popover", () => {
    const setFrom = vi.fn();
    const setTo = vi.fn();

    render(
      <ChatComposer
        {...defaultProps}
        showFilters={true}
        from="2026-09-01"
        to="2026-09-10"
        setFrom={setFrom}
        setTo={setTo}
      />,
    );

    const fromInput = screen.getByLabelText("Earliest date");
    const toInput = screen.getByLabelText("Latest date");

    fireEvent.change(fromInput, { target: { value: "2026-09-05" } });
    expect(setFrom).toHaveBeenCalledWith("2026-09-05");

    fireEvent.change(toInput, { target: { value: "2026-09-15" } });
    expect(setTo).toHaveBeenCalledWith("2026-09-15");
  });

  it("shows error alert and styles input borders with danger color when date range is inverted", () => {
    render(<ChatComposer {...defaultProps} showFilters={true} from="2026-09-20" to="2026-09-10" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Start date cannot be after end date.");

    const fromInput = screen.getByLabelText("Earliest date");
    const toInput = screen.getByLabelText("Latest date");
    expect(fromInput.closest("div")).toHaveClass("border-app-danger-border");
    expect(toInput.closest("div")).toHaveClass("border-app-danger-border");
  });

  it("closes popover when pressing Escape", () => {
    const onToggleFilters = vi.fn();

    render(<ChatComposer {...defaultProps} showFilters={true} onToggleFilters={onToggleFilters} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
  });

  it("closes popover when clicking outside", () => {
    const onToggleFilters = vi.fn();

    render(
      <div>
        <span data-testid="outside-element">Outside</span>
        <ChatComposer {...defaultProps} showFilters={true} onToggleFilters={onToggleFilters} />
      </div>,
    );

    fireEvent.pointerDown(screen.getByTestId("outside-element"));
    expect(onToggleFilters).toHaveBeenCalledTimes(1);
  });
});
