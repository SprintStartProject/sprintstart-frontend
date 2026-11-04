import { Check, CheckCircle2, CircleCheck, CircleSlash, ExternalLink, Lock } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import type { DiscoveredRepositoryItem, RepositoryLinkState } from "./discoveryTypes";

function ConnectedIcon({ isEnabled }: { isEnabled: boolean | null }) {
  return isEnabled === false ? (
    <CircleSlash
      role="img"
      aria-label="Disabled"
      className="h-4 w-4 shrink-0 text-app-text-subtle"
    />
  ) : (
    <CircleCheck
      role="img"
      aria-label="Enabled"
      className="h-4 w-4 shrink-0 text-app-success-text"
    />
  );
}

/** What connecting the repository would do, as a badge — none for a brand-new repository. */
function LinkBadge({ linkState }: { linkState: RepositoryLinkState }) {
  if (linkState === "in-project") {
    return (
      <Badge variant="neutral" size="sm" className="gap-1">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        In this project
      </Badge>
    );
  }
  if (linkState === "linkable") {
    return (
      <Badge
        variant="brand"
        size="sm"
        className="gap-1"
        title="Already ingested. Adding it here reuses its artifacts instead of ingesting again."
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Already ingested
      </Badge>
    );
  }
  if (linkState === "unresolved") {
    return (
      <Badge
        variant="neutral"
        size="sm"
        className="gap-1"
        title="Connected to another project, but its repository id could not be resolved."
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Connected
      </Badge>
    );
  }
  return null;
}

function rowClass(disabled: boolean, selected: boolean): string {
  if (disabled) return "cursor-not-allowed border-app-border bg-app-surface-muted opacity-70";
  return selected
    ? "border-app-brand bg-app-brand-soft shadow-sm"
    : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover";
}

function CheckBox({
  selected,
  disabled,
  onToggle,
}: {
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="relative flex shrink-0 items-center">
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 items-center justify-center rounded-md border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-focus peer-focus-visible:outline-solid ${
          selected
            ? "border-app-brand bg-app-brand text-white"
            : "border-app-border-strong bg-app-surface"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
    </span>
  );
}

type RepositoryRowProps = {
  repository: DiscoveredRepositoryItem;
  linkState: RepositoryLinkState;
  selected: boolean;
  disabled: boolean;
  providerName: string;
  onToggle: () => void;
};

/** One discovered repository: a checkbox, its name, what is known about it, and a link out. */
export function RepositoryRow({
  repository,
  linkState,
  selected,
  disabled,
  providerName,
  onToggle,
}: RepositoryRowProps) {
  const title = repository.label ?? repository.name;

  return (
    <li>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${rowClass(disabled, selected)}`}
      >
        <CheckBox selected={selected} disabled={disabled} onToggle={onToggle} />

        {/* Name and badges share one wrapping row: on a narrow row the badges drop to the next
            line instead of squeezing the name to a couple of characters. Stays single-line and
            right-aligned from sm up (name grows via sm:flex-1). */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
          {repository.alreadyConnected && <ConnectedIcon isEnabled={repository.isEnabled} />}

          <span className="max-w-full min-w-0 truncate text-sm font-medium text-app-text sm:flex-1">
            {title}
          </span>

          {repository.alreadyConnected && repository.isEnabled === false && (
            <Badge variant="neutral" size="sm">
              Disabled
            </Badge>
          )}

          <Badge variant={repository.isPrivate ? "orange" : "success"} size="sm" className="gap-1">
            {repository.isPrivate && <Lock className="h-3 w-3" aria-hidden="true" />}
            {repository.isPrivate ? "Private" : "Public"}
          </Badge>

          <LinkBadge linkState={linkState} />
        </div>

        {repository.url && (
          <a
            href={repository.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open ${title} on ${providerName}`}
            className="shrink-0 text-app-text-muted transition hover:text-app-brand"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </label>
    </li>
  );
}
