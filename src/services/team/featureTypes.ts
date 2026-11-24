/**
 * The feature types the team services speak in, in one place.
 *
 * They live in `features/team-management` and `features/onboarding`, and no feature exposes an
 * `index.ts` for them yet. Every file in this folder takes them from here, so the coupling is one
 * list instead of one import per file. When the features get a public entry point, this file is
 * the only one that changes.
 */
export type {
  ProjectRole,
  Skill,
  SkillLevel,
  SkillStatus,
  SkillSuggestion,
  TeamOverviewUser,
} from "../teamManagementTypes.ts";
export type {
  OnboardingPhaseEndpoint,
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
  StepType,
} from "../onboardingTypes.ts";
