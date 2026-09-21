import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DinoUnlockPopover } from "../../../../../src/features/settings/components/DinoUnlockPopover";

describe("DinoUnlockPopover", () => {
  it("renders nothing when toast is null", () => {
    const { container } = render(<DinoUnlockPopover toast={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders playful whisper with kbd badge when unlocking", () => {
    render(<DinoUnlockPopover toast="shh... 🤫 press Space while AI is thinking" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/shh\.\.\. press/i)).toBeInTheDocument();
    expect(screen.getByText("Space")).toBeInTheDocument();
    expect(screen.getByText("Space").tagName.toLowerCase()).toBe("kbd");
    expect(screen.getByText(/while AI is thinking/i)).toBeInTheDocument();
  });

  it("renders you saw nothing whisper when locking", () => {
    render(<DinoUnlockPopover toast="you saw nothing... 🫣" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/you saw nothing\.\.\./i)).toBeInTheDocument();
    expect(screen.getByLabelText("peeking")).toBeInTheDocument();
  });

  it("renders raw string for any unmapped toast message", () => {
    render(<DinoUnlockPopover toast="Custom message" />);

    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });
});
