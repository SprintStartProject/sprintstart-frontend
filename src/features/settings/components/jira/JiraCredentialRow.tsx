import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { centralSpringToken } from "../../../../styles/tokens";
import {
  parseApiError,
  describeRefreshFailure,
} from "../../../../services/apiError";
import {
  changeJiraCredentialName,
  changeJiraCredentialToken,
  deleteJiraCredential,
} from "../../../../services/sources/jiraService";
import type { JiraCredentialsDto } from "../../../../services/sources/jiraService";

type JiraCredentialRowProps = {
  credential: JiraCredentialsDto;
  onSaved: () => Promise<void>;
};

type Panel = "none" | "rename" | "rotate" | "delete";

/**
 * One row in the Jira credential list. Only one inline panel (rename, rotate or
 * delete) is open at a time; they share a single input/error/busy state since
 * they are mutually exclusive. Rename and rotate reuse the same text field
 * (rename prefilled with the current name, rotate empty and masked). The
 * credential is identified by `(userEmail, displayName)` for every mutation.
 */
export function JiraCredentialRow({
  credential,
  onSaved,
}: JiraCredentialRowProps) {
  const { userEmail, displayName } = credential;

  const [panel, setPanel] = useState<Panel>("none");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);

  const openRename = () => {
    setPanel("rename");
    setValue(displayName);
    setError("");
  };
  const openRotate = () => {
    setPanel("rotate");
    setValue("");
    setError("");
  };
  const openDelete = () => {
    setPanel("delete");
    setError("");
  };
  const close = () => {
    if (busyRef.current) return;
    setPanel("none");
    setError("");
  };

  /**
   * Runs a mutation, then refreshes the list. A failed mutation keeps the
   * panel open with the server message; a mutation that succeeds but whose
   * refetch fails still closes with a distinct "couldn't refresh" note.
   */
  const runMutation = async (
    mutate: () => Promise<unknown>,
    fallback: string,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    setError("");
    try {
      try {
        await mutate();
      } catch (mutationError) {
        setError(parseApiError(mutationError, fallback));
        return;
      }
      try {
        await onSaved();
      } catch (refreshError) {
        setError(describeRefreshFailure(refreshError));
        return;
      }
      setPanel("none");
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  };

  const submitRename = () =>
    void runMutation(
      () =>
        changeJiraCredentialName({
          userEmail,
          oldName: displayName,
          newName: value.trim(),
        }),
      "Failed to rename credential.",
    );

  const submitRotate = () =>
    void runMutation(
      () =>
        changeJiraCredentialToken({
          userEmail,
          tokenName: displayName,
          newToken: value.trim(),
        }),
      "Failed to rotate token.",
    );

  const confirmDelete = () =>
    void runMutation(
      () => deleteJiraCredential({ userEmail, tokenName: displayName }),
      "Failed to delete credential.",
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={centralSpringToken}
      className="border-b border-app-border last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:gap-4 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface-muted">
          <KeyRound className="h-4 w-4 text-app-text-muted" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-app-text">
            {displayName}
          </p>
          <p className="break-words text-xs text-app-text-muted">{userEmail}</p>
        </div>

        {panel === "none" && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={openRename}
              data-testid={`settings-jira-rename-open-${displayName}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text sm:flex-none"
              aria-label={`Rename credential ${displayName}`}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Rename
            </button>
            <button
              type="button"
              onClick={openRotate}
              data-testid={`settings-jira-rotate-open-${displayName}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text sm:flex-none"
              aria-label={`Rotate token ${displayName}`}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Rotate
            </button>
            <button
              type="button"
              onClick={openDelete}
              data-testid={`settings-jira-delete-open-${displayName}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-app-danger-bg bg-app-danger-bg px-3 text-sm font-medium text-app-danger-text transition-colors hover:bg-app-danger-solid hover:text-white sm:flex-none"
              aria-label={`Delete credential ${displayName}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {panel === "rename" && (
          <motion.form
            key="rename"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={centralSpringToken}
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
            aria-label={`Rename credential ${displayName}`}
            className="border-t border-app-brand-border bg-app-brand-soft px-4 py-4 sm:px-5"
          >
            <p className="mb-3 text-sm font-semibold text-app-text">
              Rename credential
            </p>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`settings-jira-rename-${displayName}`}
                  className="mb-1.5 block text-xs font-medium text-app-text-muted"
                >
                  New name
                </label>
                <input
                  id={`settings-jira-rename-${displayName}`}
                  data-testid={`settings-jira-rename-input-${displayName}`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. default"
                  required
                  maxLength={64}
                  disabled={isBusy}
                  className="h-11 w-full rounded-xl border border-app-brand-border bg-app-surface px-4 text-sm font-medium text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                <button
                  type="submit"
                  data-testid={`settings-jira-rename-submit-${displayName}`}
                  disabled={isBusy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-brand px-4 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Pencil className="h-4 w-4" aria-hidden />
                  )}
                  {isBusy ? "Renaming..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={isBusy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-app-danger-text">
                {error}
              </p>
            )}
          </motion.form>
        )}

        {panel === "rotate" && (
          <motion.form
            key="rotate"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={centralSpringToken}
            onSubmit={(e) => {
              e.preventDefault();
              submitRotate();
            }}
            aria-label={`Rotate token ${displayName}`}
            className="border-t border-app-brand-border bg-app-brand-soft px-4 py-4 sm:px-5"
          >
            <p className="mb-3 text-sm font-semibold text-app-text">
              Rotate token
            </p>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`settings-jira-rotate-${displayName}`}
                  className="mb-1.5 block text-xs font-medium text-app-text-muted"
                >
                  New API token
                </label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled"
                    aria-hidden
                  />
                  <input
                    id={`settings-jira-rotate-${displayName}`}
                    data-testid={`settings-jira-rotate-input-${displayName}`}
                    type="password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="New Jira API token"
                    required
                    autoComplete="off"
                    disabled={isBusy}
                    className="h-11 w-full rounded-xl border border-app-brand-border bg-app-surface pl-11 pr-4 text-sm font-medium text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                <button
                  type="submit"
                  data-testid={`settings-jira-rotate-submit-${displayName}`}
                  disabled={isBusy}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-brand px-4 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  {isBusy ? "Rotating..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={isBusy}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-app-danger-text">
                {error}
              </p>
            )}
          </motion.form>
        )}

        {panel === "delete" && (
          <motion.div
            key="delete"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={centralSpringToken}
            className="border-t border-app-border bg-app-danger-bg px-5 py-4"
          >
            <p className="mb-3 text-sm text-app-danger-text">
              Delete <strong>{displayName}</strong>? This cannot be undone and
              may break connected Jira instances.
            </p>
            {error && (
              <p role="alert" className="mb-2 text-sm text-app-danger-text">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={confirmDelete}
                data-testid={`settings-jira-delete-confirm-${displayName}`}
                disabled={isBusy}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-app-danger-solid px-4 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={isBusy}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
