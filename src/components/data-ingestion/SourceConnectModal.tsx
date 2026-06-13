import {
    RefreshCw,
    X,
    type LucideIcon,
} from "lucide-react";
import type { FormEvent } from "react";
import type { SourceSystem } from "../../types/ingestionTypes.ts";

export type ConnectState = "idle" | "loading" | "success" | "error";

export type SourceConnectMeta = {
    name: string;
    type: string;
    icon: LucideIcon;
    description: string;
};

type SourceConnectModalProps = {
    selectedSourceSystem: SourceSystem;
    sourceSystems: SourceSystem[];
    sourceMeta: Record<SourceSystem, SourceConnectMeta>;
    owner: string;
    repositoryName: string;
    connectState: ConnectState;
    errorMessage: string | null;
    onSourceSystemChange: (sourceSystem: SourceSystem) => void;
    onOwnerChange: (value: string) => void;
    onRepositoryNameChange: (value: string) => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SourceConnectModal({
                                       selectedSourceSystem,
                                       sourceSystems,
                                       sourceMeta,
                                       owner,
                                       repositoryName,
                                       connectState,
                                       errorMessage,
                                       onSourceSystemChange,
                                       onOwnerChange,
                                       onRepositoryNameChange,
                                       onClose,
                                       onSubmit,
                                   }: SourceConnectModalProps) {
    const isLoading = connectState === "loading";
    const selectedMeta = sourceMeta[selectedSourceSystem];
    const SelectedIcon = selectedMeta.icon;
    const isGithubSelected = selectedSourceSystem === "GITHUB";

    const isSubmitDisabled =
        isLoading || !isGithubSelected || !owner.trim() || !repositoryName.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-app-border bg-app-surface shadow-xl">
                <div className="flex items-start justify-between gap-4 border-b border-app-border px-6 py-5">
                    <div>
                        <h2 className="text-xl font-bold text-app-text">
                            Add Data Source
                        </h2>

                        <p className="mt-1 text-sm text-app-text-muted">
                            Choose which source type you want to connect to SprintStart.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded-xl p-2 text-app-text-muted transition hover:bg-app-bg-soft hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Close source connect modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
                    <div>
                        <p className="text-sm font-medium text-app-text">
                            Source type
                        </p>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            {sourceSystems.map((sourceSystem) => {
                                const meta = sourceMeta[sourceSystem];
                                const Icon = meta.icon;
                                const isSelected = selectedSourceSystem === sourceSystem;
                                const isAvailable = sourceSystem === "GITHUB";

                                return (
                                    <button
                                        key={sourceSystem}
                                        type="button"
                                        onClick={() => onSourceSystemChange(sourceSystem)}
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

                                        <p className="mt-1 line-clamp-2 text-xs text-app-text-muted">
                                            {meta.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-app-border bg-app-surface-muted p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft">
                                <SelectedIcon size={20} className="text-app-text-muted" />
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
                            {selectedMeta.type} can already be selected in the UI, but no
                            frontend service is connected for this source type yet.
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

                                <input
                                    id="github-owner"
                                    value={owner}
                                    onChange={(event) => onOwnerChange(event.target.value)}
                                    disabled={isLoading}
                                    placeholder="SprintStartProject"
                                    className="mt-2 w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-disabled focus:border-app-brand disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="github-repository-name"
                                    className="text-sm font-medium text-app-text"
                                >
                                    Repository name
                                </label>

                                <input
                                    id="github-repository-name"
                                    value={repositoryName}
                                    onChange={(event) =>
                                        onRepositoryNameChange(event.target.value)
                                    }
                                    disabled={isLoading}
                                    placeholder="sprintstart-backend"
                                    className="mt-2 w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-disabled focus:border-app-brand disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-app-border pt-5 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            className="flex items-center justify-center gap-2 rounded-xl bg-app-brand px-4 py-3 text-sm font-semibold text-app-text-inverse transition hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading && (
                                <RefreshCw size={16} className="animate-spin" />
                            )}
                            {isLoading
                                ? "Connecting..."
                                : isGithubSelected
                                    ? "Connect Source"
                                    : "Not Available Yet"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}