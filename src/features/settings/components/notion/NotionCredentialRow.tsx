import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Field";
import { IconTile } from "../../../../components/ui/IconTile";
import { Input } from "../../../../components/ui/Input";
import { useToast } from "../../../../context/useToast";
import { centralSpringToken } from "../../../../styles/tokens";
import { ApiError } from "../../../../services/apiClient";
import { describeRefreshFailure } from "../../../../services/apiError";
import {
  changeNotionCredentialName,
  changeNotionCredentialToken,
  deleteNotionCredential,
} from "../../../../services/sources/notionService";
import type { NotionCredentialDto } from "../../../../services/sources/notionService";
import { describeNotionCredentialError } from "./notionCredentialErrors";

type NotionCredentialRowProps = {
  credential: NotionCredentialDto;
  onSaved: () => Promise<void>;
};

type Panel = "none" | "rename" | "rotate" | "delete";

/**
 * One row in the Notion credential list. Only one inline panel (rename,
 * rotate or delete) is open at a time; they share a single input/error/busy
 * state since they are mutually exclusive. Rename and rotate reuse the same
 * text field (rename prefilled with the current name, rotate empty and
 * masked). The credential is identified by its name alone for every mutation.
 */
export function NotionCredentialRow({ credential, onSaved }: NotionCredentialRowProps) {
  const { name: displayName, updatedAt, workspaceName } = credential;
  const updatedLabel = new Date(updatedAt).toLocaleDateString();

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
        toast.error(describeNotionCredentialError(mutationError, fallback));
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
        changeNotionCredentialName({
          oldName: displayName,
          newName: value.trim(),
        }),
      "Couldn't rename the credential.",
      "Credential renamed",
    );

  const submitRotate = () =>
    void runMutation(
      () =>
        changeNotionCredentialToken({
          name: displayName,
          newToken: value.trim(),
        }),
      "Couldn't rotate the token.",
      "Notion token rotated",
    );

  // The backend answers 409 while a connected workspace still uses the credential; the shared
  // credential error text would call that "name already exists", so it is translated here.
  const deleteCredential = async () => {
    try {
      await deleteNotionCredential({ name: displayName });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new Error("Still used by a connected workspace. Remove it from its project first.");
      }
      throw error;
    }
  };

  const confirmDelete = () =>
    void runMutation(deleteCredential, "Couldn't delete the credential.", "Credential deleted");

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
        <IconTile icon={KeyRound} size="lg" tone="neutral" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold break-words text-app-text">{displayName}</p>
          <p className="text-xs break-words text-app-text-muted">
            {workspaceName
              ? `Workspace ${workspaceName} · Updated ${updatedLabel}`
              : `Updated ${updatedLabel}`}
          </p>
        </div>

        {panel === "none" && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={openRename}
              data-testid={`settings-notion-rename-open-${displayName}`}
              icon={<Pencil className="h-3.5 w-3.5" />}
              aria-label={`Rename credential ${displayName}`}
              className="flex-1 max-sm:h-11 sm:flex-none"
            >
              <span className="hidden sm:inline">Rename</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={openRotate}
              data-testid={`settings-notion-rotate-open-${displayName}`}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              aria-label={`Rotate token ${displayName}`}
              className="flex-1 max-sm:h-11 sm:flex-none"
            >
              <span className="hidden sm:inline">Rotate</span>
            </Button>
            <Button
              variant="dangerSoft"
              size="sm"
              onClick={openDelete}
              data-testid={`settings-notion-delete-open-${displayName}`}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              aria-label={`Delete credential ${displayName}`}
              className="flex-1 max-sm:h-11 sm:flex-none"
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
                controlId={`settings-notion-rename-${displayName}`}
                required
                disabled={isBusy}
                className="min-w-0 flex-1"
              >
                <Input
                  data-testid={`settings-notion-rename-input-${displayName}`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. team-wiki"
                  required
                  maxLength={64}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                <Button
                  variant="primary"
                  type="submit"
                  data-testid={`settings-notion-rename-submit-${displayName}`}
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
                label="New Notion token"
                controlId={`settings-notion-rotate-${displayName}`}
                required
                disabled={isBusy}
                className="min-w-0 flex-1"
              >
                <Input
                  data-testid={`settings-notion-rotate-input-${displayName}`}
                  type="password"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="New Notion token"
                  required
                  autoComplete="off"
                  icon={<KeyRound className="h-4 w-4" />}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                <Button
                  variant="primary"
                  type="submit"
                  data-testid={`settings-notion-rotate-submit-${displayName}`}
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
            <p className="mb-3 text-sm break-words text-app-danger-text">
              Delete <strong>{displayName}</strong>? This cannot be undone. A credential that a
              connected workspace still uses cannot be deleted.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                data-testid={`settings-notion-delete-confirm-${displayName}`}
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
