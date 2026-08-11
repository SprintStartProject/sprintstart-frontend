import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AccessBadge,
  PermissionGroupBadge,
  SourceStatusBadge,
} from "../../../../../src/features/admin/components/Badges";

describe("Badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AccessBadge renders its children with the provided variant class", () => {
    render(<AccessBadge variant="success">Active</AccessBadge>);
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-app-success-bg");
  });

  it("AccessBadge defaults to the brand variant", () => {
    render(<AccessBadge>Default</AccessBadge>);
    expect(screen.getByText("Default").className).toContain("bg-app-brand-soft");
  });

  it("PermissionGroupBadge maps Admin to the warning variant", () => {
    render(<PermissionGroupBadge permissionGroup="Admin" />);
    const badge = screen.getByText("Admin");
    expect(badge.className).toContain("bg-app-warning-bg");
  });

  it("PermissionGroupBadge maps Project Manager to the success variant", () => {
    render(<PermissionGroupBadge permissionGroup="Project Manager" />);
    expect(screen.getByText("Project Manager").className).toContain("bg-app-success-bg");
  });

  it("PermissionGroupBadge maps other groups to the neutral variant", () => {
    render(<PermissionGroupBadge permissionGroup="User" />);
    expect(screen.getByText("User").className).toContain("bg-app-neutral-bg");
  });

  it("SourceStatusBadge maps CONNECTED to the success variant", () => {
    render(<SourceStatusBadge status="CONNECTED" />);
    expect(screen.getByText("CONNECTED").className).toContain("bg-app-success-bg");
  });

  it("SourceStatusBadge maps INDEXING to the warning variant", () => {
    render(<SourceStatusBadge status="INDEXING" />);
    expect(screen.getByText("INDEXING").className).toContain("bg-app-warning-bg");
  });

  it("SourceStatusBadge maps ERROR to the danger variant", () => {
    render(<SourceStatusBadge status="ERROR" />);
    expect(screen.getByText("ERROR").className).toContain("bg-app-danger-bg");
  });

  it("SourceStatusBadge maps DISCONNECTED to the neutral variant", () => {
    render(<SourceStatusBadge status="DISCONNECTED" />);
    expect(screen.getByText("DISCONNECTED").className).toContain("bg-app-neutral-bg");
  });

  it("SourceStatusBadge falls back to the brand variant for unknown statuses", () => {
    render(<SourceStatusBadge status="PENDING" />);
    expect(screen.getByText("PENDING").className).toContain("bg-app-brand-soft");
  });
});
