import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { CenteredState, StateIcon } from "./CenteredState";

export function LoadingScreen() {
  return (
    <CenteredState>
      <Loader2 className="h-8 w-8 animate-spin text-app-brand" aria-hidden="true" />
      <p className="mt-4 text-sm text-app-text-muted">Loading onboarding path...</p>
    </CenteredState>
  );
}

export function LoadErrorScreen({ message }: { message: string }) {
  return (
    <CenteredState>
      <StateIcon tone="danger">
        <AlertCircle className="h-7 w-7" />
      </StateIcon>
      <h2 className="mt-5 text-xl font-semibold text-app-text">Onboarding could not be loaded</h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">{message}</p>
      <Button className="mt-6" variant="primary" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </CenteredState>
  );
}
