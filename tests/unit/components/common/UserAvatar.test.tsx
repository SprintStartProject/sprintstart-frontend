import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UserAvatar } from "../../../../src/components/common/UserAvatar";

vi.mock("boring-avatars", () => ({
  default: ({ name, size }: { name: string; size: number }) => (
    <div data-testid="boring-avatar" data-name={name} data-size={size} />
  ),
}));

describe("UserAvatar", () => {
  it('renders with role="img" and an aria-label using fallbackName', () => {
    render(<UserAvatar fallbackName="Jane Doe" />);
    expect(screen.getByRole("img", { name: "Avatar for Jane Doe" })).toBeInTheDocument();
  });

  it('falls back to "User" in the aria-label when fallbackName is not provided', () => {
    render(<UserAvatar />);
    expect(screen.getByRole("img", { name: "Avatar for User" })).toBeInTheDocument();
  });

  it("uses profileIcon as the avatar seed when provided", () => {
    render(<UserAvatar profileIcon="icon-1" fallbackName="Jane" />);
    const avatar = screen.getByTestId("boring-avatar");
    expect(avatar).toHaveAttribute("data-name", "icon-1");
  });

  it("uses seed as the avatar seed when profileIcon is not provided", () => {
    render(<UserAvatar seed="custom-seed" fallbackName="Jane" />);
    const avatar = screen.getByTestId("boring-avatar");
    expect(avatar).toHaveAttribute("data-name", "custom-seed");
  });

  it("uses fallbackName as the avatar seed when profileIcon and seed are not provided", () => {
    render(<UserAvatar fallbackName="Jane" />);
    const avatar = screen.getByTestId("boring-avatar");
    expect(avatar).toHaveAttribute("data-name", "Jane");
  });

  it('falls back to "User" seed when nothing is provided', () => {
    render(<UserAvatar />);
    const avatar = screen.getByTestId("boring-avatar");
    expect(avatar).toHaveAttribute("data-name", "User");
  });

  it("passes the size prop to the avatar", () => {
    render(<UserAvatar size={32} fallbackName="Jane" />);
    const avatar = screen.getByTestId("boring-avatar");
    expect(avatar).toHaveAttribute("data-size", "32");
  });

  it("defaults to size 40 when size is not provided", () => {
    render(<UserAvatar fallbackName="Jane" />);
    const avatar = screen.getByTestId("boring-avatar");
    expect(avatar).toHaveAttribute("data-size", "40");
  });

  it("marks the inner avatar as aria-hidden", () => {
    render(<UserAvatar fallbackName="Jane" />);
    const wrapper = screen.getByRole("img", { name: "Avatar for Jane" });
    const inner = wrapper.querySelector('[aria-hidden="true"]');
    expect(inner).toBeInTheDocument();
  });
});
