import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";
import { MainContent } from "../../../components/layout/MainContent";
import { Button } from "../../../components/ui/Button.tsx";

/** Shown while the path first loads, or while a different version is being walked to. */
export function BlueprintPathLoading() {
  return (
    <MainContent
      placeholder
      className="flex min-h-80 items-center justify-center gap-3 text-app-text-muted"
    >
      <Loader2 className="h-5 w-5 animate-spin" /> Loading blueprint…
    </MainContent>
  );
}

/** Shown when the path could not be loaded, with the way back to the list. */
export function BlueprintPathMissing({
  message,
  onBack,
}: {
  message: string | null;
  onBack: () => void;
}) {
  return (
    <MainContent className="mx-auto max-w-3xl p-8">
      <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
        Back to blueprints
      </Button>
      <p role="alert" className="mt-6 flex items-start gap-1.5 text-app-danger-text">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {message || "Blueprint path not found."}
      </p>
    </MainContent>
  );
}
