import type { OnboardingFeedback } from "../../services/teamManagementService";

/**
 * Whether a piece of feedback is still unread by the PM.
 *
 * The one definition, used wherever unread feedback is counted, badged or offered a "Mark read".
 * There were three, differing exactly when the backend omitted `read` -- one surface then offered
 * to mark an item read while another already called it read, so the PM was told there was unread
 * feedback they could not find. The service normalises `read` on the way in; this is how it is
 * asked about.
 *
 * It lives here rather than beside the type in `teamManagementService` so that a test mocking that
 * service does not have to re-implement it.
 */
export function isFeedbackUnread(feedback: OnboardingFeedback): boolean {
  return !feedback.read && !feedback.readAt;
}
