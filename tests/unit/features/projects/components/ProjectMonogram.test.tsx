import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProjectMonogram } from "../../../../../src/features/projects/components/ProjectMonogram";
import { monogramTint } from "../../../../../src/features/projects/projectMonogram";

describe("ProjectMonogram", () => {
  it("shows the project's initials", () => {
    const { container } = render(<ProjectMonogram projectId="p1" name="Apollo Mission" />);

    expect(container).toHaveTextContent("AM");
  });

  it("uses the same tint for the same project in every size", () => {
    const tint = monogramTint("p1").split(" ");

    for (const size of ["sm", "md", "lg"] as const) {
      const { container, unmount } = render(
        <ProjectMonogram projectId="p1" name="Apollo" size={size} />,
      );

      expect(container.firstElementChild).toHaveClass(...tint);
      unmount();
    }
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<ProjectMonogram projectId="p1" name="Apollo" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
