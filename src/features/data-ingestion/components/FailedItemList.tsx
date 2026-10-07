import { useState } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import { describeFailedItem } from "../failedItems.ts";
import type { FailedArtifact } from "../types.ts";

const CLAMP_THRESHOLD = 160;

function FailedItem({ item }: { item: FailedArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.reason.length > CLAMP_THRESHOLD;

  return (
    <div className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3">
      <p className="text-sm font-medium wrap-anywhere text-app-warning-text">
        {describeFailedItem(item)}
      </p>

      <p
        className={`mt-1 text-sm wrap-anywhere text-app-text-muted ${
          isLong && !expanded ? "line-clamp-3" : ""
        }`}
      >
        {item.reason}
      </p>

      {isLong && (
        <Button
          variant="ghost"
          size="xs"
          className="mt-1"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show full message"}
        </Button>
      )}
    </div>
  );
}

export function FailedItemList({ items }: { items: FailedArtifact[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FailedItem
          key={`${item.artifactType}-${item.reference ?? ""}-${item.reason}`}
          item={item}
        />
      ))}
    </div>
  );
}
