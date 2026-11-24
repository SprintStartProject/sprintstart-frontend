import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LifecycleNotice } from "../../../../src/features/blueprints/components/LifecycleNotice.tsx";

describe("LifecycleNotice", () => {
  it("tells the author a draft reaches nobody until it is published", () => {
    render(<LifecycleNotice status="DRAFT" version={4} />);
    expect(screen.getByText("Draft v4.")).toBeInTheDocument();
    expect(screen.getByText(/Nothing here reaches anybody/)).toBeInTheDocument();
  });

  it("tells the reader an archived version is read-only", () => {
    render(<LifecycleNotice status="ARCHIVED" version={2} />);
    expect(screen.getByText("Archived v2.")).toBeInTheDocument();
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
  });

  it("tells the reader the published version is what new hires get", () => {
    render(<LifecycleNotice status="ACTIVE" version={3} />);
    expect(screen.getByText("Published v3.")).toBeInTheDocument();
    expect(screen.getByText(/what a new hire on/)).toBeInTheDocument();
  });
});
