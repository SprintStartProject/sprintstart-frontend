import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SpaceInvadersModal } from "../features/space-invaders/components/SpaceInvadersModal.tsx";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Rocket } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();
  // Auto-open the game on the 404 page (the canonical easter-egg entry
  // point); closing it leaves the 404 message + dashboard link visible.
  const [invadersOpen, setInvadersOpen] = useState(true);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-app-bg text-app-text">
      <PageHeader
        title="404 Not Found"
        subtitle="The page you are looking for does not exist."
        icon={Rocket}
        className="px-8 py-6"
      />

      <div className="-mt-16 flex flex-1 flex-col items-center justify-center p-8">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-5xl font-black text-app-brand">404</h1>
          <p className="mx-auto max-w-md text-xl text-app-text-muted">
            Looks like you&apos;re lost in space! While we try to find a way back, why don&apos;t
            you save the galaxy?
          </p>
        </div>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            void navigate("/");
          }}
          className="mt-12"
        >
          Return to Dashboard
        </Button>
      </div>

      <SpaceInvadersModal open={invadersOpen} onClose={() => setInvadersOpen(false)} />
    </div>
  );
}
