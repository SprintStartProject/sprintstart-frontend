/** Turns what the backend says went wrong into something a hire can act on. */
export function describeGenerationError(message: string): string {
  if (/no active blueprint/i.test(message)) {
    return "This project has no published onboarding blueprint yet. Ask your project manager to publish one, then try again.";
  }
  if (/multiple active blueprints/i.test(message)) {
    return "This project has more than one published onboarding blueprint. Ask your project manager to archive all but one.";
  }
  if (/status: 403/.test(message) || /not assigned/i.test(message)) {
    return "You are not assigned to this project, so no onboarding path can be built from it.";
  }
  if (/status: 5\d\d/.test(message) || /failed to fetch/i.test(message)) {
    return "The onboarding service could not be reached. Try again in a moment.";
  }
  return message || "Your onboarding path could not be built.";
}
