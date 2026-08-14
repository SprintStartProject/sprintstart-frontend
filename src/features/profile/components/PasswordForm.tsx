import { Button } from "../../../components/ui/Button";
import keycloak from "../../../config/keycloak";
import { buildRedirectUri } from "../../../auth/redirectUtils";

/**
 * Form component for changing the user's password.
 * Redirects to the Keycloak update password flow.
 */
export function PasswordForm() {
  const handleRedirect = () => {
    // Trigger Keycloak's direct password update flow and redirect back to Settings
    void keycloak.login({
      action: "UPDATE_PASSWORD",
      redirectUri: buildRedirectUri("/settings"),
    });
  };

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-app-text">Change Password</h2>

      <p className="mb-4 text-sm text-app-text/70">
        Password management is handled securely through our authentication provider.
      </p>

      <div className="pt-2">
        <Button variant="primary" onClick={handleRedirect}>
          Update Password
        </Button>
      </div>
    </div>
  );
}
