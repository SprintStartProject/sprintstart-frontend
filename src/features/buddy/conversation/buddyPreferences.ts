/**
 * Where "is the buddy in team mode" lives between reloads — scoped to the signed-in user, the
 * way the project selection is. A shared browser must not hand one manager's team conversation
 * to the next.
 */
function teamModeStorageKey(userId: string): string {
  return `buddyTeamMode:${userId}`;
}

export function readStoredTeamMode(userId: string): boolean {
  try {
    return localStorage.getItem(teamModeStorageKey(userId)) === "true";
  } catch {
    // Private modes can refuse storage outright. Not a reason to refuse the conversation.
    return false;
  }
}

export function writeStoredTeamMode(userId: string, value: boolean): void {
  try {
    localStorage.setItem(teamModeStorageKey(userId), value ? "true" : "false");
  } catch {
    // Nothing to do: the conversation still switches, it just will not be remembered.
  }
}

/**
 * The mentor-tools switch's storage, alongside the team-mode one — same rules, opposite default.
 *
 * Default ON: the full mentor is what the feature is for, and a hire who has never touched the
 * switch must get it. Only an explicit "off" is remembered.
 */
function mentorToolsStorageKey(userId: string): string {
  return `buddyMentorTools:${userId}`;
}

export function readStoredMentorTools(userId: string): boolean {
  try {
    return localStorage.getItem(mentorToolsStorageKey(userId)) !== "false";
  } catch {
    return true;
  }
}

export function writeStoredMentorTools(userId: string, value: boolean): void {
  try {
    localStorage.setItem(mentorToolsStorageKey(userId), value ? "true" : "false");
  } catch {
    // Nothing to do: the switch still works, it just will not be remembered.
  }
}
