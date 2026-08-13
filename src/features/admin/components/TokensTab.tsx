import { useState, type FormEvent } from "react";
import { Key, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { ApiError } from "../../../services/apiClient";
import {
  addGithubPat,
  deleteGithubPat,
  updateGithubPat,
} from "../../../services/sources/githubService";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { JiraCredentialsSection } from "../../settings/components/jira/JiraCredentialsSection";

const INVALID_TOKEN_MESSAGE =
  "Invalid token format. Use a classic PAT (ghp_...) or a fine-grained PAT (github_pat_...).";

function parseApiError(error: unknown, validationFallback: string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
  }
  try {
    const body = JSON.parse(error.message) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // not JSON
  }
  return validationFallback;
}

type Provider = "github" | "jira";

const PROVIDERS: SegmentedTabOption<Provider>[] = [
  { value: "github", label: "GitHub", testId: "admin-tokens-segment-github" },
  { value: "jira", label: "Jira", testId: "admin-tokens-segment-jira" },
];

type TokensTabProps = {
  tokenNames: string[];
  onRefresh: () => void;
  /**
   * Email of the current admin, used only to prefill new Jira credentials.
   * Null or undefined when the profile carries no email.
   */
  userEmail?: string | null;
};

export function TokensTab({ tokenNames, onRefresh, userEmail }: TokensTabProps) {
  const [provider, setProvider] = useState<Provider>("github");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addToken, setAddToken] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [rotatingName, setRotatingName] = useState<string | null>(null);
  const [rotateToken, setRotateToken] = useState("");
  const [rotateError, setRotateError] = useState("");
  const [isRotating, setIsRotating] = useState(false);

  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleAddOpen = () => {
    setIsAddOpen(true);
    setAddName("");
    setAddToken("");
    setAddError("");
  };

  const handleAddCancel = () => {
    if (isAdding) return;
    setIsAddOpen(false);
    setAddError("");
  };

  const handleAddSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsAdding(true);
    setAddError("");

    try {
      await addGithubPat(addName.trim(), addToken.trim());
      setIsAddOpen(false);
      setAddName("");
      setAddToken("");
      onRefresh();
    } catch (error) {
      setAddError(parseApiError(error, INVALID_TOKEN_MESSAGE));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRotateOpen = (name: string) => {
    setRotatingName(name);
    setRotateToken("");
    setRotateError("");
    setPendingDeleteName(null);
  };

  const handleRotateCancel = () => {
    if (isRotating) return;
    setRotatingName(null);
    setRotateError("");
  };

  const submitRotateToken = async () => {
    if (!rotatingName) return;
    setIsRotating(true);
    setRotateError("");

    try {
      await updateGithubPat(rotatingName, rotateToken.trim());
      setRotatingName(null);
      setRotateToken("");
      onRefresh();
    } catch (error) {
      setRotateError(parseApiError(error, INVALID_TOKEN_MESSAGE));
    } finally {
      setIsRotating(false);
    }
  };

  const handleRotateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitRotateToken();
  };

  const handleDeleteRequest = (name: string) => {
    setPendingDeleteName(name);
    setDeleteError("");
    setRotatingName(null);
  };

  const handleDeleteCancel = () => {
    if (isDeleting) return;
    setPendingDeleteName(null);
    setDeleteError("");
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteName) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteGithubPat(pendingDeleteName);
      setPendingDeleteName(null);
      onRefresh();
    } catch (error) {
      setDeleteError(parseApiError(error, "Failed to delete token."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SegmentedTabs
        value={provider}
        options={PROVIDERS}
        onChange={setProvider}
        layoutId="admin-tokens-provider-pill"
        ariaLabel="Access token provider"
      />

      {provider === "jira" ? (
        <JiraCredentialsSection defaultUserEmail={userEmail ?? null} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-app-text">
              {tokenNames.length} {tokenNames.length === 1 ? "token" : "tokens"}
            </span>

            {!isAddOpen && (
              <Button
                variant="primary"
                onClick={handleAddOpen}
                icon={<Plus className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Add Token
              </Button>
            )}
          </div>

          {isAddOpen && (
            <form
              onSubmit={(e) => void handleAddSubmit(e)}
              className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-app-text">New GitHub PAT</span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={handleAddCancel}
                  disabled={isAdding}
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <Field label="Token name" controlId="add-token-name" disabled={isAdding}>
                  <Input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. default"
                    required
                  />
                </Field>

                <Field label="Token (ghp_...)" controlId="add-token-value" disabled={isAdding}>
                  <Input
                    type="password"
                    value={addToken}
                    onChange={(e) => setAddToken(e.target.value)}
                    placeholder="ghp_... or github_pat_..."
                    required
                  />
                </Field>

                {addError && <p className="text-sm text-app-danger-text">{addError}</p>}

                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={handleAddCancel} disabled={isAdding}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" loading={isAdding}>
                    {isAdding ? "Adding..." : "Add Token"}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {tokenNames.length === 0 && !isAddOpen ? (
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <Key className="h-8 w-8 text-app-text-disabled" />
                <div>
                  <p className="text-base font-medium text-app-text">No tokens yet</p>
                  <p className="mt-1 text-sm text-app-text-muted">
                    Add a GitHub Personal Access Token to enable repository ingestion.
                  </p>
                </div>
              </div>
            </div>
          ) : tokenNames.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
              {tokenNames.map((name) => (
                <div key={name} className="border-b border-app-border last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:gap-4 sm:px-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface-muted">
                      <Key className="h-4 w-4 text-app-text-muted" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold break-words text-app-text">{name}</p>
                      <p className="text-xs text-app-text-muted">GitHub PAT (classic)</p>
                    </div>

                    {pendingDeleteName !== name && rotatingName !== name && (
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRotateOpen(name)}
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                          className="flex-1 sm:flex-none"
                        >
                          Rotate
                        </Button>
                        <Button
                          variant="dangerSoft"
                          size="sm"
                          onClick={() => handleDeleteRequest(name)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          className="flex-1 sm:flex-none"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  {pendingDeleteName === name && (
                    <div className="border-t border-app-border bg-app-danger-bg px-5 py-4">
                      <p className="mb-3 text-sm text-app-danger-text">
                        Delete <strong>{name}</strong>? This cannot be undone and may break
                        connected repositories.
                      </p>
                      {deleteError && (
                        <p className="mb-2 text-sm text-app-danger-text">{deleteError}</p>
                      )}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDeleteConfirm()}
                          loading={isDeleting}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDeleteCancel}
                          disabled={isDeleting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {rotatingName === name && (
                    <form
                      onSubmit={(event) => void handleRotateSubmit(event)}
                      className="border-t border-app-brand-border bg-app-brand-soft px-4 py-4 sm:px-5"
                    >
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-app-text">Rotate token</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <Field
                          label="New GitHub PAT"
                          controlId="rotate-token-value"
                          disabled={isRotating}
                          className="min-w-0 flex-1"
                        >
                          <Input
                            type="password"
                            value={rotateToken}
                            onChange={(event) => setRotateToken(event.target.value)}
                            placeholder="ghp_... or github_pat_..."
                            required
                            icon={<Key className="h-4 w-4" />}
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                          <Button
                            variant="primary"
                            type="submit"
                            loading={isRotating}
                            icon={<RefreshCw className="h-4 w-4" />}
                          >
                            {isRotating ? "Rotating..." : "Confirm"}
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={handleRotateCancel}
                            disabled={isRotating}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>

                      {rotateError && (
                        <p className="mt-3 text-sm text-app-danger-text">{rotateError}</p>
                      )}
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
