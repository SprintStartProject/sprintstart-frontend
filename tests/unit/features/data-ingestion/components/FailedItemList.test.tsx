import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FailedItemList } from "../../../../../src/features/data-ingestion/components/FailedItemList";

const LONG_REASON = `Request failed: https://api.bitbucket.org/2.0/repositories/acme/app/pullrequests?${"q=state".repeat(30)}`;

describe("FailedItemList", () => {
  it("shows a readable title and the reason", () => {
    render(
      <FailedItemList
        items={[{ artifactType: "PULL_REQUEST", reference: null, reason: "Request failed" }]}
      />,
    );

    expect(screen.getByText("Pull requests could not be fetched")).toBeInTheDocument();
    expect(screen.getByText("Request failed")).toBeInTheDocument();
  });

  it("has no toggle for a short reason", () => {
    render(<FailedItemList items={[{ artifactType: "FILE", reference: "a", reason: "short" }]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("short")).not.toHaveClass("line-clamp-3");
  });

  it("clamps a long reason and expands it with the toggle", async () => {
    const user = userEvent.setup();
    render(
      <FailedItemList
        items={[{ artifactType: "PULL_REQUEST", reference: null, reason: LONG_REASON }]}
      />,
    );

    const reason = screen.getByText(LONG_REASON);
    expect(reason).toHaveClass("line-clamp-3");
    expect(reason).toHaveClass("wrap-anywhere");

    const toggle = screen.getByRole("button", { name: "Show full message" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(reason).not.toHaveClass("line-clamp-3");
    const collapse = screen.getByRole("button", { name: "Show less" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    await user.click(collapse);
    expect(reason).toHaveClass("line-clamp-3");
  });
});
