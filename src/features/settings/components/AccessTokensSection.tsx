import { useState } from "react";
import { useAuth } from "../../../context/useAuth";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { TokensSection } from "./TokensSection";
import { JiraCredentialsSection } from "./jira/JiraCredentialsSection";

type Provider = "github" | "jira";

const PROVIDERS: SegmentedTabOption<Provider>[] = [
  { value: "github", label: "GitHub", testId: "access-tokens-segment-github" },
  { value: "jira", label: "Jira", testId: "access-tokens-segment-jira" },
];

/**
 * Access-token hub for the Settings page. A thin shell over the two providers
 * whose credential models differ (global GitHub PATs vs. per-user Jira
 * credentials), co-located under a `GitHub | Jira` segmented control. GitHub
 * renders the unchanged {@link TokensSection}; Jira renders the current user's
 * own {@link JiraCredentialsSection}. The profile email only pre-fills new entries.
 */
export function AccessTokensSection() {
  const { profile } = useAuth();
  const [provider, setProvider] = useState<Provider>("github");

  return (
    <div className="space-y-5">
      <SegmentedTabs
        value={provider}
        options={PROVIDERS}
        onChange={setProvider}
        layoutId="access-tokens-provider-pill"
        ariaLabel="Access token provider"
      />

      {provider === "github" ? (
        <TokensSection />
      ) : (
        <JiraCredentialsSection defaultUserEmail={profile?.email ?? null} />
      )}
    </div>
  );
}
