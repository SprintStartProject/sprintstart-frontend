import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Field";
import { Input } from "../../../../components/ui/Input";
import { useToast } from "../../../../context/useToast";
import { centralSpringToken } from "../../../../styles/tokens";
import { parseApiError, describeRefreshFailure } from "../../../../services/apiError";
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
export function JiraCredentialRow({ credential, onSaved }: JiraCredentialRowProps) {
  const { userEmail, displayName } = credential;

  const [panel, setPanel] = useState<Panel>("none");
  const [value, setValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  const toast = useToast();

  const openRename = () => {
    setPanel("rename");
    setValue(displayName);
  };
  const openRotate = () => {
    setPanel("rotate");
    setValue("");
  };
  const openDelete = () => {
    setPanel("delete");
  };
  const close = () => {
    if (busyRef.current) return;
    setPanel("none");
  };

  /**
   * Runs a mutation, then refreshes the list. A failed mutation keeps the panel
   * open and surfaces the server message as an error toast; a mutation that
   * succeeds but whose refetch fails still closes, with a "saved, but stale"
   * warning toast; a full success closes with a success toast.
   */
  const runMutation = async (
    mutate: () => Promise<unknown>,
    fallback: string,
    successMessage: string,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try {
      try {
        await mutate();
      } catch (mutationError) {
        toast.error(parseApiError(mutationError, fallback));
        return;
      }
      try {
        await onSaved();
      } catch (refreshError) {
        toast.warning(describeRefreshFailure(refreshError));
        setPanel("none");
        return;
      }
      toast.success(successMessage);
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
      "Couldn't rename the credential.",
      "Credential renamed",
    );

  const submitRotate = () =>
    void runMutation(
      () =>
        changeJiraCredentialToken({
          userEmail,
          tokenName: displayName,
          newToken: value.trim(),
        }),
      "Couldn't rotate the token.",
      "Jira token rotated",
    );

  const confirmDelete = () =>
    void runMutation(
      () => deleteJiraCredential({ userEmail, tokenName: displayName }),
      "Couldn't delete the credential.",
      "Credential deleted",
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
          <p className="text-sm font-semibold break-words text-app-text">{displayName}</p>
          <p className="text-xs break-words text-app-text-muted">{userEmail}</p>
        </div>

        {panel === "none" && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={openRename}
              data-testid={`settings-jira-rename-open-${displayName}`}
              icon={<Pencil className="h-3.5 w-3.5" />}
              aria-label={`Rename credential ${displayName}`}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Rename</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={openRotate}
              data-testid={`settings-jira-rotate-open-${displayName}`}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              aria-label={`Rotate token ${displayName}`}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Rotate</span>
            </Button>
            <Button
              variant="dangerSoft"
              size="sm"
              onClick={openDelete}
              data-testid={`settings-jira-delete-open-${displayName}`}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              aria-label={`Delete credential ${displayName}`}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Delete</span>
            </Button>
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
            <p className="mb-3 text-sm font-semibold text-app-text">Rename credential</p>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <Field
                label="New name"
                controlId={`settings-jira-rename-${displayName}`}
                disabled={isBusy}
                className="min-w-0 flex-1"
              >
                <Input
                  data-testid={`settings-jira-rename-input-${displayName}`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. default"
                  required
                  maxLength={64}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                <Button
                  variant="primary"
                  type="submit"
                  data-testid={`settings-jira-rename-submit-${displayName}`}
                  loading={isBusy}
                  icon={<Pencil className="h-4 w-4" />}
                >
                  {isBusy ? "Renaming..." : "Confirm"}
                </Button>
                <Button variant="secondary" onClick={close} disabled={isBusy}>
                  Cancel
                </Button>
              </div>
            </div>
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
            <p className="mb-3 text-sm font-semibold text-app-text">Rotate token</p>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <Field
                label="New API token"
                controlId={`settings-jira-rotate-${displayName}`}
                disabled={isBusy}
                className="min-w-0 flex-1"
              >
                <Input
                  data-testid={`settings-jira-rotate-input-${displayName}`}
                  type="password"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="New Jira API token"
                  required
                  autoComplete="off"
                  icon={<KeyRound className="h-4 w-4" />}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                <Button
                  variant="primary"
                  type="submit"
                  data-testid={`settings-jira-rotate-submit-${displayName}`}
                  loading={isBusy}
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  {isBusy ? "Rotating..." : "Confirm"}
                </Button>
                <Button variant="secondary" onClick={close} disabled={isBusy}>
                  Cancel
                </Button>
              </div>
            </div>
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
              Delete <strong>{displayName}</strong>? This cannot be undone and may break connected
              Jira instances.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                data-testid={`settings-jira-delete-confirm-${displayName}`}
                loading={isBusy}
              >
                {isBusy ? "Deleting..." : "Delete"}
              </Button>
              <Button variant="secondary" size="sm" onClick={close} disabled={isBusy}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
