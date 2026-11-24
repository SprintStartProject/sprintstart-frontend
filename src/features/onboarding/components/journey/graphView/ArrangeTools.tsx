import { LayoutGrid, Move } from "lucide-react";
import { CanvasButton } from "../../../graph/JourneyCanvas";
import { arrangeLabel } from "./graphRules";
import type { GraphEditing } from "./graphTypes";

type ArrangeToolsProps = {
  arranging: boolean;
  editing: GraphEditing | undefined;
  onToggle: () => void;
  onTidy: () => void;
};

/** The toolbar buttons for rearranging the graph: toggle arranging, and tidy the layout. */
export function ArrangeTools({ arranging, editing, onToggle, onTidy }: ArrangeToolsProps) {
  return (
    <>
      <CanvasButton label={arrangeLabel(arranging, editing)} active={arranging} onClick={onToggle}>
        <Move className="h-4 w-4" />
      </CanvasButton>
      <CanvasButton label="Tidy up layout" onClick={onTidy}>
        <LayoutGrid className="h-4 w-4" />
      </CanvasButton>
    </>
  );
}
