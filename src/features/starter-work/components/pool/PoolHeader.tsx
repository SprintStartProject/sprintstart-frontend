import { Cloud, List as ListIcon, RefreshCw } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { InfoHint } from "../../../../components/ui/InfoHint";
import { formatRelativeDate } from "../../format";
import type { PoolView } from "./poolTypes";

type PoolHeaderProps = {
  taskCount: number;
  lastCheckedAt: string | null;
  canSync: boolean;
  isSyncing: boolean;
  onSync?: () => void;
  view: PoolView;
  onChangeView: (view: PoolView) => void;
};

function SyncButton({ isSyncing, onSync }: { isSyncing: boolean; onSync: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={isSyncing}
      onClick={onSync}
      icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
    >
      {isSyncing ? "Syncing…" : "Sync"}
    </Button>
  );
}

function ViewToggle({ view, onChange }: { view: PoolView; onChange: (view: PoolView) => void }) {
  return (
    <div
      className="hidden items-center gap-1 rounded-xl border border-app-border bg-app-surface-muted p-1 sm:flex"
      role="group"
      aria-label="Pool view"
    >
      <Button
        variant={view === "cloud" ? "secondary" : "ghost"}
        size="sm"
        iconOnly
        aria-label="Cloud view"
        aria-pressed={view === "cloud"}
        title="Cloud view"
        onClick={() => onChange("cloud")}
      >
        <Cloud className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="sm"
        iconOnly
        aria-label="List view"
        aria-pressed={view === "list"}
        title="List view"
        onClick={() => onChange("list")}
      >
        <ListIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Title, count, last-checked line, sync button and the cloud/list toggle. */
export function PoolHeader({
  taskCount,
  lastCheckedAt,
  canSync,
  isSyncing,
  onSync,
  view,
  onChangeView,
}: PoolHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-semibold tracking-tight text-app-text">In the pool</h2>
      {taskCount > 0 && (
        <Badge variant="neutral" size="md" className="tabular-nums">
          {taskCount}
        </Badge>
      )}
      <InfoHint
        label="About the pool"
        text="Review lifts a task's rank; edit orientation to write its guide."
      />

      <div className="ml-auto flex items-center gap-2">
        {/* Nothing to say before the first sync ever runs — a pool that has never been checked is a
            normal starting state, not a problem worth a line about. */}
        {lastCheckedAt && (
          <span className="text-xs text-app-text-subtle">
            Checked {formatRelativeDate(lastCheckedAt)}
          </span>
        )}
        {canSync && onSync && <SyncButton isSyncing={isSyncing} onSync={onSync} />}
        <ViewToggle view={view} onChange={onChangeView} />
      </div>
    </div>
  );
}
