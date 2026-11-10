import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArrivalStepList } from "../../../../src/features/arrival/components/ArrivalStepList";
import type { ArrivalStep } from "../../../../src/services/arrivalTypes";

const step = (over: Partial<ArrivalStep> = {}): ArrivalStep => ({
  key: "vpn",
  projectId: null,
  projectName: null,
  title: "Request VPN access",
  description: "Ask IT",
  href: null,
  position: 0,
  settledBy: "DECLARED",
  selfConfirmable: true,
  settled: false,
  settledAt: null,
  rigor: null,
  ...over,
});

describe("ArrivalStepList text", () => {
  it("shows a step's title and description as they are", () => {
    render(<ArrivalStepList steps={[step()]} />);

    expect(screen.getByText("Request VPN access")).toBeInTheDocument();
    expect(screen.getByText("Ask IT")).toBeInTheDocument();
  });

  it("draws both through the renderer it is given", () => {
    render(
      <ArrivalStepList
        steps={[step()]}
        renderText={(text) => <mark data-testid="drawn">{text}</mark>}
      />,
    );

    const drawn = screen.getAllByTestId("drawn");
    expect(drawn.map((node) => node.textContent)).toEqual(["Request VPN access", "Ask IT"]);
  });

  it("leaves the description out when a step has none", () => {
    render(
      <ArrivalStepList
        steps={[step({ description: null })]}
        renderText={(text) => <mark data-testid="drawn">{text}</mark>}
      />,
    );

    expect(screen.getAllByTestId("drawn")).toHaveLength(1);
  });
});
