import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Search, XCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EmptyState } from "../../../components/ui/EmptyState.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { AccountEnabledToggle } from "../../admin/components/AccountEnabledToggle.tsx";
import { slidingIndicatorSpringToken } from "../../../styles/tokens";
import type { ConnectorListItem } from "../types.ts";
import { ConnectorSourcesSection } from "./ConnectorSourcesSection.tsx";

type ConnectorListProps = {
  connectors: ConnectorListItem[];
  togglingConnectorId: string | null;
  /** Scopes the per-connector source list to a project. */
  projectId?: string | null;
  onToggleEnabled: (connector: ConnectorListItem) => void;
  onSourcesSaved?: () => void;
};

/**
 * Manager for the registered connectors, with a layout that flips at `lg`:
 *
 * - On `lg` and up it is a master–detail view: a searchable list on the left
 *   (one compact row per connector, with a quick enable/disable switch) and the
 *   selected connector's detail with its in-scope source management on the right.
 * - Below `lg` there is no room for two columns, so the same rows become an
 *   accordion: tapping a row expands its detail inline beneath it, rather than
 *   pushing to a separate detail screen.
 *
 * The enable/disable switch always lives in the list row (both layouts), so the
 * control is never shown twice. Enabled state reads from the switch position
 * plus an icon, never colour alone.
 */
export function ConnectorList({
  connectors,
  togglingConnectorId,
  projectId,
  onToggleEnabled,
  onSourcesSaved,
}: ConnectorListProps) {
  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mobile-only accordion state. Seeded with the first connector so the modal
  // opens showing a connector's sources rather than a bare list; on `lg` the
  // detail column is driven by `selectedId` instead and ignores this.
  const [expandedId, setExpandedId] = useState<string | null>(connectors[0]?.id ?? null);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? connectors.filter(
            (connector) =>
              connector.meta.label.toLowerCase().includes(normalizedQuery) ||
              connector.id.toLowerCase().includes(normalizedQuery),
          )
        : connectors,
    [connectors, normalizedQuery],
  );

  if (connectors.length === 0) {
    return (
      <EmptyState title="No connectors registered">
        Connectors will appear here once they are registered on the backend.
      </EmptyState>
    );
  }

  const enabledCount = connectors.filter((connector) => connector.enabled).length;
  const disabledCount = connectors.length - enabledCount;
  // Derived, not synced via an effect: an unknown/cleared selection falls back
  // to the first connector, so the detail pane is never empty on desktop.
  const selected = connectors.find((connector) => connector.id === selectedId) ?? connectors[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-app-success-border bg-app-success-bg px-2.5 py-1 text-xs font-medium text-app-success-text">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {enabledCount} active
        </span>

        {disabledCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-app-danger-border bg-app-danger-bg px-2.5 py-1 text-xs font-medium text-app-danger-text">
            <XCircle className="h-3.5 w-3.5" />
            {disabledCount} disabled
          </span>
        )}
      </div>

      {/* A fixed height on `lg` keeps the modal from resizing as you switch
          between connectors; each column scrolls internally instead. Below `lg`
          the height is intrinsic so the accordion can grow the modal body. */}
      <div className="grid gap-4 lg:h-[26rem] lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        {/* List (accordion below `lg`, master column on `lg`+). `min-w-0` keeps
            the mobile grid column from stretching to a long source URL's
            intrinsic width (which would scroll the modal sideways) — on `lg` the
            `minmax(0,…)` columns already cap this. */}
        <div className="flex min-w-0 flex-col lg:min-h-0">
          <Input
            size="sm"
            icon={<Search className="h-4 w-4" />}
            aria-label="Search connectors"
            placeholder="Search connectors…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="mt-3 space-y-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {filtered.map((connector) => {
              const Icon = connector.meta.icon;
              const isSelected = connector.id === selected?.id;
              const isExpanded = connector.id === expandedId;
              const isToggling = togglingConnectorId === connector.id;

              return (
                <div key={connector.id}>
                  <div className="relative flex items-center gap-1.5 rounded-xl p-1.5">
                    {isSelected && (
                      // Desktop-only selection highlight; on mobile the accordion
                      // expansion is the affordance, so it would only double up.
                      <motion.span
                        layoutId="connector-selected"
                        aria-hidden="true"
                        transition={
                          prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken
                        }
                        className="absolute inset-0 hidden rounded-xl border border-app-brand-border-strong bg-app-brand-soft lg:block"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(connector.id);
                        // Accordion toggle for mobile; on `lg` this only ever
                        // opens/closes the (hidden) inline block, never the
                        // detail column, which follows `selectedId`.
                        setExpandedId((current) =>
                          current === connector.id ? null : connector.id,
                        );
                      }}
                      aria-pressed={isSelected}
                      aria-expanded={isExpanded}
                      className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-surface-muted text-app-text-muted">
                        <Icon className="h-5 w-5" />
                      </span>

                      <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium text-app-text">
                        {connector.meta.label}
                      </span>

                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform duration-200 lg:hidden ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <div className="relative z-10 shrink-0">
                      <AccountEnabledToggle
                        enabled={connector.enabled}
                        disabled={isToggling}
                        ariaLabel={`${connector.enabled ? "Disable" : "Enable"} the ${connector.meta.label}`}
                        onChange={() => onToggleEnabled(connector)}
                      />
                    </div>
                  </div>

                  {/* Inline detail — accordion body, mobile only. On `lg` the
                      detail lives in the right-hand column instead. */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="detail"
                        initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
                        }
                        className="overflow-hidden lg:hidden"
                      >
                        <div className="px-1.5 pb-2">
                          <p className="text-sm text-app-text-muted">
                            {connector.meta.description}
                          </p>

                          <ConnectorSourcesSection
                            connector={connector}
                            projectId={projectId}
                            onSourcesSaved={onSourcesSaved}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-app-text-muted">
                No connectors match your search.
              </p>
            )}
          </div>
        </div>

        {/* Detail — `lg`+ only; below that the accordion above carries it. */}
        <div className="hidden lg:block lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-app-border lg:pl-5">
          {selected && (
            <ConnectorDetail
              key={selected.id}
              connector={selected}
              projectId={projectId}
              onSourcesSaved={onSourcesSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type ConnectorDetailProps = {
  connector: ConnectorListItem;
  projectId?: string | null;
  onSourcesSaved?: () => void;
};

function ConnectorDetail({ connector, projectId, onSourcesSaved }: ConnectorDetailProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = connector.meta.icon;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-surface-muted text-app-text-muted">
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-app-text">{connector.meta.label}</p>
          <p className="mt-1 line-clamp-2 text-sm text-app-text-muted">
            {connector.meta.description}
          </p>
        </div>
      </div>

      <ConnectorSourcesSection
        connector={connector}
        projectId={projectId}
        onSourcesSaved={onSourcesSaved}
      />
    </motion.div>
  );
}
