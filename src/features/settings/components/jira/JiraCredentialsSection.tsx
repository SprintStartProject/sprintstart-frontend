import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Loader2, Plus, RefreshCw } from "lucide-react";
import { centralSpringToken } from "../../../../styles/tokens";
import { useJiraCredentials } from "../../hooks/useJiraCredentials";
import { JiraCredentialAddForm } from "./JiraCredentialAddForm";
import { JiraCredentialRow } from "./JiraCredentialRow";

type JiraCredentialsSectionProps = {
  /**
   * Initial Jira account email to manage (defaults to the login email); null
   * when the profile has none. Only a default — the field below is editable.
   */
  userEmail: string | null;
};

/**
 * Jira API-credential management, scoped to a single Jira account email.
 *
 * Jira credentials are keyed by `(userEmail, tokenName)` where `userEmail` is
 * the Jira/Atlassian account email used to authenticate against Jira — which is
 * not necessarily the SprintStart login email. Since there is no "list all
 * credentials" endpoint (only per-email), the account email is an editable
 * scope at the top of the section: it drives both the listing and what an added
 * credential is stored under, so a credential can never be added into an email
 * the user isn't viewing. It defaults to the login email for convenience.
 */
export function JiraCredentialsSection({
  userEmail,
}: JiraCredentialsSectionProps) {
  const [accountEmail, setAccountEmail] = useState(userEmail ?? "");
  const [emailDraft, setEmailDraft] = useState(userEmail ?? "");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const trimmedEmail = accountEmail.trim();
  const { credentials, loaded, error, isRefreshing, reload } =
    useJiraCredentials(trimmedEmail || undefined);

  const handleSaved = async () => {
    await reload();
  };

  // Commit the typed email as the active scope. Changing it closes the add form
  // so a half-filled credential can't be submitted against the old account.
  const commitEmail = () => {
    const next = emailDraft.trim();
    if (next === accountEmail.trim()) return;
    setAccountEmail(emailDraft);
    setIsAddOpen(false);
  };

  const showInitialLoading = !loaded && isRefreshing;

  return (
    <div
      className="space-y-4"
      aria-busy={isRefreshing}
      aria-live="polite"
      aria-label="Jira credentials"
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          commitEmail();
        }}
      >
        <label
          htmlFor="settings-jira-account-email"
          className="mb-1.5 block text-xs font-medium text-app-text-muted"
        >
          Jira account email
        </label>
        <input
          id="settings-jira-account-email"
          data-testid="settings-jira-account-email"
          type="email"
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          onBlur={commitEmail}
          placeholder="jira-account@example.com"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
        />
        <p className="mt-1.5 text-xs text-app-text-subtle">
          Credentials are stored per Jira account email, which may differ from
          your login email.
        </p>
      </form>

      {!trimmedEmail ? (
        <div
          className="rounded-2xl border border-app-border bg-app-surface p-8 text-center"
          data-testid="settings-jira-no-email"
        >
          <KeyRound
            className="mx-auto mb-3 h-8 w-8 text-app-text-disabled"
            aria-hidden
          />
          <p className="text-base font-medium text-app-text">
            Enter a Jira account email
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            Enter the Jira account email above to view and manage its
            credentials.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-app-text">
                {credentials.length}{" "}
                {credentials.length === 1 ? "credential" : "credentials"}
              </span>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={isRefreshing}
                data-testid="settings-jira-refresh"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Refresh Jira credentials"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            {!isAddOpen && (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                data-testid="settings-jira-add-open"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-brand bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:border-app-brand-hover hover:bg-app-brand-hover sm:w-auto"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add Credential
              </button>
            )}
          </div>

          {showInitialLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2
                className="h-6 w-6 animate-spin text-app-brand"
                aria-hidden
              />
              <span className="sr-only">Loading Jira credentials...</span>
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
                      userEmail={trimmedEmail}
                      onClose={() => setIsAddOpen(false)}
                      onSaved={handleSaved}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {credentials.length === 0 && !isAddOpen ? (
                <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-8">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <KeyRound
                      className="h-8 w-8 text-app-text-disabled"
                      aria-hidden
                    />
                    <div>
                      <p className="text-base font-medium text-app-text">
                        No credentials yet
                      </p>
                      <p className="mt-1 text-sm text-app-text-muted">
                        Add a Jira API token to connect and ingest Jira
                        instances.
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
                          <JiraCredentialRow
                            credential={credential}
                            onSaved={handleSaved}
                          />
                        </li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
