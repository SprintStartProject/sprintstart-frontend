import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Spinner } from "../../../components/ui/Spinner";
import { centralSpringToken } from "../../../styles/tokens";
import type { AccessConnector } from "../types";

type AccessConnectorGroupProps = {
  connector: AccessConnector;
  /**
   * Hides the group without unmounting it. The view needs every connector
   * loaded to know which ones are in use, so filtered-out sources are hidden
   * rather than removed — unmounting them would throw the answer away and
   * refetch on every filter change.
   */
  isHidden: boolean;
  /**
   * Whether this source's add form is showing. Opening is not the group's to
   * decide — the view's single "Add credential" button owns that, so the group
   * can only close the form again.
   */
  isAddOpen: boolean;
  onAddClose: () => void;
  /** Reports load state and entry count upward, for the filter and empty state. */
  onStateChange: (connectorId: string, state: { loaded: boolean; count: number }) => void;
};

/**
 * One source's block inside the unified access view: a header naming the
 * source, its own add form, and the list of stored entries.
 *
 * All source-specific behaviour comes from the connector — this component only
 * owns the chrome that has to look the same for every source, which is what
 * makes the view scale to many connectors instead of one tab each.
 *
 * There is deliberately no refresh control: every mutation reloads the source
 * it touched, so a manual refresh would only add a button per group to a view
 * whose whole point is staying calm as connectors are added.
 */
export function AccessConnectorGroup({
  connector,
  isHidden,
  isAddOpen,
  onAddClose,
  onStateChange,
}: AccessConnectorGroupProps) {
  // Not written as a bare `useEntries()` on purpose: the connector is fixed by
  // its position in the registry, so this is a single, unconditional hook call
  // per rendered group.
  const { entries, loaded, error, isRefreshing, reload } = connector.useEntries();

  const Icon = connector.icon;
  const AddForm = connector.AddForm;
  const Row = connector.Row;

  const count = entries.length;
  const showInitialLoading = !loaded && isRefreshing;

  const connectorId = connector.id;
  useEffect(() => {
    onStateChange(connectorId, { loaded, count });
  }, [connectorId, loaded, count, onStateChange]);

  const handleSaved = async () => {
    await reload();
  };

  return (
    <section
      hidden={isHidden}
      className="space-y-4"
      aria-busy={isRefreshing}
      aria-live="polite"
      aria-label={`${connector.label} access`}
      data-testid={`access-group-${connector.id}`}
    >
      {/* Header carries identity only. A per-source add button used to sit here
          too, which meant two controls for the same job once the view grew its
          own — and the one in the header claimed to be about GitHub while the
          other claimed to be about credentials in general. */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface-muted">
          <Icon className="h-4 w-4 text-app-text-muted" aria-hidden />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-app-text">{connector.label}</p>
          <p className="text-xs text-app-text-muted">
            {count} {count === 1 ? connector.noun.one : connector.noun.many}
          </p>
        </div>
      </div>

      {showInitialLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" label={`Loading ${connector.label} access`} />
        </div>
      )}

      {!showInitialLoading && error && (
        <div
          role="alert"
          className="rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
          data-testid={`access-error-${connector.id}`}
        >
          {error}
        </div>
      )}

      {!showInitialLoading && (
        <>
          <AnimatePresence initial={false}>
            {isAddOpen && (
              <motion.div
                key="add-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={centralSpringToken}
              >
                <AddForm onClose={onAddClose} onSaved={handleSaved} />
              </motion.div>
            )}
          </AnimatePresence>

          {count === 0 && !isAddOpen ? (
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <Icon className="h-8 w-8 text-app-text-disabled" aria-hidden />
                <div>
                  <p className="text-base font-medium text-app-text">{connector.emptyTitle}</p>
                  <p className="mt-1 text-sm text-app-text-muted">{connector.emptyDescription}</p>
                </div>
              </div>
            </div>
          ) : (
            count > 0 && (
              <ul
                className="overflow-hidden rounded-2xl border border-app-border bg-app-surface"
                aria-label={`Stored ${connector.label} access entries`}
              >
                <AnimatePresence initial={false}>
                  {entries.map((entry) => (
                    <li key={entry.key}>
                      <Row entry={entry} onSaved={handleSaved} />
                    </li>
                  ))}
                </AnimatePresence>
              </ul>
            )
          )}
        </>
      )}
    </section>
  );
}
