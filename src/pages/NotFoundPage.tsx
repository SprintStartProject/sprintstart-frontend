import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EggModalShell } from "../features/easter-eggs/components/EggModalShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Rocket } from "lucide-react";

/**
 * Catch-all 404 page. Shows a "not found" message with a dashboard link
 * and a small easter-egg teaser: a rocket that opens the Space Invaders
 * game for whoever notices it while they are stranded here.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const [invadersOpen, setInvadersOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-app-text">
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

        {/* Easter-egg teaser, styled to blend into the page: only people who
            read the copy closely will think of clicking it. The whole row is
            the button (text + rocket) so the target is generous, and it reuses
            the page's "lost in space" line so the invitation reads as part of
            the joke rather than a stray CTA.
            The accessible name starts with the words on screen (WCAG 2.5.3):
            an aria-label that replaced them would leave voice control with
            nothing to say that it can see. The hint rides along as a suffix
            inside the name instead. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setInvadersOpen(true)}
          trailingIcon={<span aria-hidden="true">🚀</span>}
          className="mt-4"
        >
          While you&apos;re lost in space&hellip;
          <span className="sr-only"> play Space Invaders</span>
        </Button>

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

      <EggModalShell
        eggId="space-invaders"
        open={invadersOpen}
        onClose={() => setInvadersOpen(false)}
      />
    </div>
  );
}
