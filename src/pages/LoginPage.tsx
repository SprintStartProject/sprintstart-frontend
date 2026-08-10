import { useAuth } from "../context/useAuth";
import { Rocket, LogIn } from "lucide-react";
import { ThemeToggle } from "../components/common/ThemeToggle";
import { Button } from "../components/ui/Button";

/**
 * The authentication entry point.
 * Redirects users to the SSO identity provider and initiates the role selection upon first login.
 */
export function LoginPage() {
  const { login, status } = useAuth();

  const handleLogin = () => {
    void login();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-app-bg p-4 text-app-text sm:p-6">
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
        <ThemeToggle
          showLabel={false}
          className="border border-app-border bg-app-surface shadow-sm"
        />
      </div>

      <div className="w-full max-w-md space-y-8 rounded-2xl border border-app-border bg-app-surface p-6 text-center shadow-2xl backdrop-blur-sm sm:p-10">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-app-brand shadow-lg">
            <Rocket className="h-9 w-9 text-white" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
              SprintStart
            </h2>
            <p className="text-sm text-app-text-muted">
              AI-Assisted Software Engineering Onboarding
            </p>
          </div>
        </div>

        <div className="space-y-6 pt-4">
          <div className="rounded-2xl border border-app-border-muted bg-app-surface-muted p-4 text-left">
            <p className="mb-2 text-xs font-medium tracking-wider text-app-text-muted uppercase">
              SSO Authentication
            </p>
            <p className="text-sm text-app-text">
              You will be redirected to our secure identity provider to sign in.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleLogin}
            loading={status === "loading"}
            icon={<LogIn className="h-5 w-5" />}
          >
            Sign in with SSO
          </Button>

          <p className="text-xs text-app-text-disabled">
            Securely managed by Keycloak OpenID Connect
          </p>
        </div>
      </div>
    </div>
  );
}
