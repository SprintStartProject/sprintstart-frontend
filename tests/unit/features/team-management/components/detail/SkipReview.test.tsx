import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkipReview } from "../../../../../../src/features/team-management/components/detail/SkipReview";

describe("SkipReview", () => {
  it("approves with the comment the PM wrote", async () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkipReview reason="I set this up last week" onReview={onReview} />);

    expect(screen.getByText("“I set this up last week”")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Comment for the member"), "Fair enough");
    await user.click(screen.getByRole("button", { name: "Approve skip" }));

    expect(onReview).toHaveBeenCalledWith("accept", "Fair enough");
  });

  it("declines without a comment too", async () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SkipReview reason="Not relevant" onReview={onReview} />);

    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(onReview).toHaveBeenCalledWith("deny", "");
  });
});
