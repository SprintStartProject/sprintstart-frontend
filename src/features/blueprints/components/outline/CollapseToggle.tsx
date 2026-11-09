import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";

interface CollapseToggleProps {
  collapsed: boolean;
  kind: "phase" | "step" | "question";
  name: string;
  onToggle: () => void;
}

/** The chevron that folds a phase, step or question away. */
export function CollapseToggle({ collapsed, kind, name, onToggle }: CollapseToggleProps) {
  return (
    <Button
      aria-label={`${collapsed ? "Expand" : "Collapse"} ${kind} ${name}`}
      aria-expanded={!collapsed}
      iconOnly
      size="sm"
      variant="ghost"
      onClick={onToggle}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </Button>
  );
}
