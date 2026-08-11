import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Spinner } from "../../../../components/ui/Spinner";
import { centralSpringToken } from "../../../../styles/tokens";
import { useJiraCredentials } from "../../hooks/useJiraCredentials";
import { JiraCredentialAddForm } from "./JiraCredentialAddForm";
import { JiraCredentialRow } from "./JiraCredentialRow";

type JiraCredentialsSectionProps = {
  /** Login email used only to prefill the add form. */
  defaultUserEmail: string | null;
};

/**
 * Manages all Jira credentials owned by the authenticated user. Credentials
 * may contain different Jira account emails; the login email only pre-fills
 * the add form.
 */
export function JiraCredentialsSection({ defaultUserEmail }: JiraCredentialsSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { credentials, loaded, error, isRefreshing, reload } = useJiraCredentials();

  const handleSaved = async () => {
    await reload();
  };

  const showInitialLoading = !loaded && isRefreshing;

  return (
    <div
      className="space-y-4"
      aria-busy={isRefreshing}
      aria-live="polite"
      aria-label="Jira credentials"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-app-text">
            {credentials.length} {credentials.length === 1 ? "credential" : "credentials"}
          </span>
        </div>

        {!isAddOpen && (
          <Button
            variant="primary"
            onClick={() => setIsAddOpen(true)}
            data-testid="settings-jira-add-open"
            icon={<Plus className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Add Credential
          </Button>
        )}
      </div>

      {showInitialLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" label="Loading Jira credentials" />
        </div>
      )}

      {!showInitialLoading && error && (
        <div
          role="alert"
          className="rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
          data-testid="settings-jira-error"
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
                <JiraCredentialAddForm
                  defaultUserEmail={defaultUserEmail}
                  onClose={() => setIsAddOpen(false)}
                  onSaved={handleSaved}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {credentials.length === 0 && !isAddOpen ? (
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <KeyRound className="h-8 w-8 text-app-text-disabled" aria-hidden />
                <div>
                  <p className="text-base font-medium text-app-text">No credentials yet</p>
                  <p className="mt-1 text-sm text-app-text-muted">
                    Add a Jira API token to connect and ingest Jira instances.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            credentials.length > 0 && (
              <ul
                className="overflow-hidden rounded-2xl border border-app-border bg-app-surface"
                aria-label="Stored Jira credentials"
              >
                <AnimatePresence initial={false}>
                  {credentials.map((credential) => (
                    <li key={credential.displayName}>
                      <JiraCredentialRow credential={credential} onSaved={handleSaved} />
                    </li>
                  ))}
                </AnimatePresence>
              </ul>
            )
          )}
        </>
      )}
    </div>
  );
}
