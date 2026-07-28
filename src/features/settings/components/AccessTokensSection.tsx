import { useState } from "react";
import { useAuth } from "../../../context/useAuth";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../../../components/ui/SegmentedControl";
import { TokensSection } from "./TokensSection";
import { JiraCredentialsSection } from "./jira/JiraCredentialsSection";

type Provider = "github" | "jira";

const PROVIDERS: ReadonlyArray<SegmentedControlOption<Provider>> = [
  { id: "github", label: "GitHub", testId: "access-tokens-segment-github" },
  { id: "jira", label: "Jira", testId: "access-tokens-segment-jira" },
];

/**
 * Access-token hub for the Settings page. A thin shell over the two providers
 * whose credential models differ (global GitHub PATs vs. per-user Jira
 * credentials), co-located under a `GitHub | Jira` segmented control. GitHub
 * renders the unchanged {@link TokensSection}; Jira renders the current user's
 * own {@link JiraCredentialsSection}, keyed by their profile email.
 */
export function AccessTokensSection() {
  const { profile } = useAuth();
  const [provider, setProvider] = useState<Provider>("github");

  return (
    <div className="space-y-5">
      <SegmentedControl
        options={PROVIDERS}
        value={provider}
        onChange={setProvider}
        ariaLabel="Access token provider"
      />

      {provider === "github" ? (
        <TokensSection />
      ) : (
        <JiraCredentialsSection userEmail={profile?.email ?? null} />
      )}
    </div>
  );
}
