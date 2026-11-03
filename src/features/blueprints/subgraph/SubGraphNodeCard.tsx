import { CircleHelp, ListChecks } from "lucide-react";
import type { BlueprintGraphCanvasNodeProps } from "../components/BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "../components/BlueprintNodeCard.tsx";
import type { BlueprintGraphNode } from "../types.ts";

export function SubGraphNodeCard({
  node,
  ...cardProps
}: { node: BlueprintGraphNode } & BlueprintGraphCanvasNodeProps) {
  const isQuestion = node.type === "QUESTION";

  return (
    <BlueprintNodeCard
      {...cardProps}
      title={node.title}
      kind={{
        label: isQuestion ? "Knowledge check" : "Step",
        icon: isQuestion ? CircleHelp : ListChecks,
      }}
      // Two kinds on one canvas, and the difference is what the hire is asked to *do*: work through
      // something, or answer for it. That is the distinction the colour carries here.
      accent={isQuestion ? "orange" : "brand"}
      // A diamond for a check, a circle for a step. Two kinds on one canvas have to stay apart for
      // a reader who cannot tell two small colours apart, and at the zoom where a whole phase fits
      // the outline is all there is left of either.
      glyph={isQuestion ? "diamond" : "round"}
    />
  );
}
