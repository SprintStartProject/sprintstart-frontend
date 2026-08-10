import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import type {
    ConnectState,
    SourceConnectMeta,
    SourceSystem,
} from "../types.ts";

type SourceConnectModalProps = {
    selectedSourceSystem: SourceSystem;
    sourceSystems: SourceSystem[];
    sourceMeta: Record<SourceSystem, SourceConnectMeta>;
    owner: string;
    repositoryName: string;
    tokenName: string;
    tokenNames: string[];
    connectState: ConnectState;
    errorMessage: string | null;
    onSourceSystemChange: (sourceSystem: SourceSystem) => void;
    onOwnerChange: (value: string) => void;
    onRepositoryNameChange: (value: string) => void;
    onTokenNameChange: (value: string) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * Modal form for connecting a new data source to SprintStart.
 * Manages the complex state of selecting a source type (e.g., GitHub) and configuring its connection parameters.
 */
export function SourceConnectModal({
    selectedSourceSystem,
    sourceSystems,
    sourceMeta,
    owner,
    repositoryName,
    tokenName,
    tokenNames,
    connectState,
    errorMessage,
    onSourceSystemChange,
    onOwnerChange,
    onRepositoryNameChange,
    onTokenNameChange,
    onClose,
    onSubmit,
}: SourceConnectModalProps) {
    const isLoading = connectState === "loading";
    const selectedMeta = sourceMeta[selectedSourceSystem];
    const SelectedIcon = selectedMeta.icon;
    const isGithubSelected = selectedSourceSystem === "GITHUB";
    const hasGithubTokens = tokenNames.length > 0;

    const isSubmitDisabled =
        isLoading ||
        !isGithubSelected ||
        !owner.trim() ||
        !tokenName.trim() ||
        !hasGithubTokens;

    return (
        <Modal
            isOpen
            title="Add Data Source"
            description="Choose which source type you want to connect to SprintStart."
            size="lg"
            isDismissDisabled={isLoading}
            onClose={onClose}
            closeLabel="Close source connect modal"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>

                    <Button
                        variant="primary"
                        type="submit"
                        form="source-connect-form"
                        disabled={isSubmitDisabled}
                        loading={isLoading}
                    >
                        {isLoading
                            ? "Connecting..."
                            : isGithubSelected
                              ? "Connect Source"
                              : "Not Available Yet"}
                    </Button>
                </>
            }
        >
                <form id="source-connect-form" onSubmit={onSubmit} className="space-y-5">
                    <div>
                        <p className="text-sm font-medium text-app-text">
                            Source type
                        </p>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            {sourceSystems.map((sourceSystem) => {
                                const meta = sourceMeta[sourceSystem];
                                const Icon = meta.icon;
                                const isSelected =
                                    selectedSourceSystem === sourceSystem;
                                const isAvailable = sourceSystem === "GITHUB";

                                return (
                                    <button
                                        key={sourceSystem}
                                        type="button"
                                        onClick={() =>
                                            onSourceSystemChange(sourceSystem)
                                        }
                                        disabled={isLoading}
                                        className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            isSelected
                                                ? "border-app-brand bg-app-brand-soft"
                                                : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-bg-soft">
                                                <Icon
                                                    size={20}
                                                    className={
                                                        isSelected
                                                            ? "text-app-brand"
                                                            : "text-app-text-muted"
                                                    }
                                                />
                                            </div>

                                            {!isAvailable && (
                                                <span className="rounded-full bg-app-bg-soft px-2.5 py-1 text-xs font-medium text-app-text-subtle">
                                                    Soon
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-3 text-sm font-semibold text-app-text">
                                            {meta.type}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-app-border bg-app-surface-muted p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft">
                                <SelectedIcon
                                    size={20}
                                    className="text-app-text-muted"
                                />
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-app-text">
                                    {selectedMeta.name}
                                </p>

                                <p className="mt-1 text-sm text-app-text-muted">
                                    {selectedMeta.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                            {errorMessage}
                        </div>
                    )}

                    {!isGithubSelected && (
                        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                            {selectedMeta.type} can already be selected in the
                            UI, but no frontend service is connected for this
                            source type yet.
                        </div>
                    )}

                    {isGithubSelected && (
                        <>
                            <div>
                                <label
                                    htmlFor="github-owner"
                                    className="text-sm font-medium text-app-text"
                                >
                                    Repository owner
                                </label>

                                <Input
                                    id="github-owner"
                                    value={owner}
                                    onChange={(event) =>
                                        onOwnerChange(event.target.value)
                                    }
                                    disabled={isLoading}
                                    placeholder="SprintStartProject, SprintStartProject/sprintstart-backend, or GitHub URL"
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="github-repository-name"
                                    className="text-sm font-medium text-app-text"
                                >
                                    Repository name
                                </label>

                                <Input
                                    id="github-repository-name"
                                    value={repositoryName}
                                    onChange={(event) =>
                                        onRepositoryNameChange(
                                            event.target.value,
                                        )
                                    }
                                    disabled={isLoading}
                                    placeholder="sprintstart-backend (optional when owner field contains owner/repo)"
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="github-token-name"
                                    className="text-sm font-medium text-app-text"
                                >
                                    GitHub access token
                                </label>

                                <Select
                                    id="github-token-name"
                                    value={tokenName}
                                    onChange={(event) =>
                                        onTokenNameChange(event.target.value)
                                    }
                                    disabled={isLoading || !hasGithubTokens}
                                    className="mt-2"
                                >
                                    {hasGithubTokens ? (
                                        tokenNames.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">
                                            No saved tokens available
                                        </option>
                                    )}
                                </Select>

                                {!hasGithubTokens && (
                                    <p className="mt-2 text-sm text-app-warning-text">
                                        Add a GitHub personal access token first,
                                        then come back to connect a repository.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                </form>
        </Modal>
    );
}
