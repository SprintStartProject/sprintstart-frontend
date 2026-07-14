export function ConnectorsLoadingState() {
    return (
        <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-brand border-t-transparent" />

            <h3 className="mt-4 text-lg font-semibold text-app-text">
                Loading connectors
            </h3>

            <p className="mt-2 text-sm text-app-text-muted">
                Fetching registered connectors and their configuration from the backend.
            </p>
        </div>
    );
}
