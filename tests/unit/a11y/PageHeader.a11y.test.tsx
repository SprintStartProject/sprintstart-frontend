import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { PageHeader } from "../../../src/components/layout/PageHeader";
import { Home } from "lucide-react";
import { MemoryRouter } from "react-router-dom";

describe("PageHeader Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <PageHeader
            icon={Home}
            title="Test Title"
            subtitle="Test Subtitle"
            actions={<button type="button">Action</button>}
          />
        </main>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
