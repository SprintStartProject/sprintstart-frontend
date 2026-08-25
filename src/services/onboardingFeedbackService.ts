import { apiClient } from "./apiClient";

const BASE = "/api/v1/onboarding/me";

/**
 * The hire's way to say a piece of onboarding content is wrong.
 *
 * This is the light half of a pair, and the pair is the point. Orientation already had a
 * "fix this" affordance, and the service's own comment defended it: a hire who knows the packet is
 * wrong *corrects* it rather than reporting into a sink. That is right — and it is the affordance a
 * newcomer is least able to use. Somebody on day three can often tell that a setup step is out of
 * date without having any idea what replaced it, and editing a packet everybody reads on the
 * strength of a guess is worse than saying nothing.
 *
 * So this reports without changing anything anybody else sees. It is not a sink: a PM sees an
 * unread count per hire on the team page and the message itself on their member detail page.
 */
export const onboardingFeedbackService = {
  /**
   * Reports a problem with onboarding content.
   *
   * `helpful: false` is the durable half of the signal, so a count exists even for somebody who
   * writes nothing useful. There is no `pageId`: that field links a module page, and an
   * orientation packet is not one — which is why what this is about travels in the message, put
   * there by the app and shown to the hire before they send it.
   */
  async reportProblem(message: string): Promise<void> {
    await apiClient.fetch<unknown>(`${BASE}/feedback`, {
      method: "POST",
      body: JSON.stringify({ helpful: false, message }),
    });
  },
};
