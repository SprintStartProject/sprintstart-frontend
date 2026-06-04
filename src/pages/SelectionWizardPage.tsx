import { useState } from "react";
import { userService } from "../services/userService";
import { WorkingArea } from "../services/types";
import { useAuth } from "../context/useAuth";

type Level = "Beginner" | "Intermediate" | "Advanced";

interface WizardState {
  workingArea: WorkingArea | null;
  level: Level | null;
}

function RoleIcon({ icon, active }: { icon: string; active: boolean }) {
  return (
      <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg transition-colors",
            active
                ? "border-app-brand-border-strong bg-app-brand-soft"
                : "border-app-border bg-app-surface-muted",
          ].join(" ")}
      >
        {icon}
      </div>
  );
}

const ROLES: { value: WorkingArea; label: string; icon: string; description: string }[] = [
  {
    value: WorkingArea.BACKEND_DEV,
    label: "Backend Developer",
    icon: "🖥️",
    description: "Server-side logic, databases & APIs",
  },
  {
    value: WorkingArea.FRONTEND_DEV,
    label: "Frontend Developer",
    icon: "🌐",
    description: "User interfaces, client-side logic & design",
  },
  {
    value: WorkingArea.HR,
    label: "HR",
    icon: "🩵",
    description: "People, culture & hiring",
  },
  {
    value: WorkingArea.QA,
    label: "QA Engineer",
    icon: "🔍",
    description: "Testing, quality & automation",
  },
  {
    value: WorkingArea.DEV_OPS,
    label: "DevOps Engineer",
    icon: "♾️",
    description: "Infrastructure, deployment & CI/CD",
  },
];

const LEVELS: { value: Level; label: string; badge: string }[] = [
  { value: "Beginner", label: "Beginner", badge: "New here" },
  { value: "Intermediate", label: "Intermediate", badge: "Some reps" },
  { value: "Advanced", label: "Advanced", badge: "Battle-tested" },
];

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
      <div className="mb-7 flex items-center gap-2">
        {[1, 2].map((s) => {
          const isCurrent = s === step;
          const isDone = s < step;

          return (
              <div key={s} className="flex items-center gap-2">
                <div
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                      isCurrent
                          ? "bg-app-brand text-white shadow-lg"
                          : isDone
                              ? "bg-app-brand-soft text-app-brand-text"
                              : "bg-app-surface-muted text-app-text-subtle",
                    ].join(" ")}
                >
                  {isDone ? "✓" : s}
                </div>

                <span
                    className={[
                      "text-[11px] transition-colors",
                      isCurrent || isDone
                          ? "text-app-brand-text"
                          : "text-app-text-subtle",
                    ].join(" ")}
                >
                            {s === 1 ? "Your role" : "Experience"}
                        </span>

                {s < 2 && (
                    <div className="mx-1 h-px w-7 bg-app-border" />
                )}
              </div>
          );
        })}
      </div>
  );
}

export function SelectionWizardPage({ open = true }: { open?: boolean } = {}) {
  const { refetchProfile } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [wizard, setWizard] = useState<WizardState>({
    workingArea: null,
    level: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canProceed1 = wizard.workingArea !== null;
  const canFinish = wizard.level !== null;

  async function handleContinue() {
    if (!wizard.workingArea) return;

    setLoading(true);
    setError(null);

    try {
      await userService.updateProfile({ workingArea: wizard.workingArea });
      await refetchProfile();
      setStep(2);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    window.location.href = "/onboarding";
  }

  return (
      <div
          role="dialog"
          aria-modal="true"
          aria-label="Role selection"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay p-4 backdrop-blur-md"
      >
        <div className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-app-border bg-app-bg p-7 shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-[200px] w-[200px] rounded-full bg-app-brand-glow blur-3xl" />

          <div className="relative z-10 mb-6">
            <h1 className="text-[22px] font-bold leading-tight text-app-text">
              Setup your profile
            </h1>
          </div>

          <div className="relative z-10">
            <StepIndicator step={step} />
          </div>

          {step === 1 && (
              <div className="relative z-10">
                <h2 className="mb-1 text-base font-semibold text-app-text">
                  What&apos;s your primary role?
                </h2>

                <p className="mb-5 text-xs text-app-text-subtle">
                  We&apos;ll tailor your onboarding path to fit how you actually work.
                </p>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {ROLES.map((role) => {
                    const active = wizard.workingArea === role.value;

                    return (
                        <button
                            key={role.value}
                            type="button"
                            onClick={() =>
                                setWizard((current) => ({
                                  ...current,
                                  workingArea: role.value,
                                }))
                            }
                            className={[
                              "flex items-start gap-2.5 rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus",
                              active
                                  ? "border-app-brand-border-strong bg-app-brand-soft shadow-lg"
                                  : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover",
                            ].join(" ")}
                        >
                          <RoleIcon icon={role.icon} active={active} />

                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 text-xs font-semibold text-app-text">
                              {role.label}
                            </div>

                            <div className="text-[10px] leading-relaxed text-app-text-subtle">
                              {role.description}
                            </div>
                          </div>

                          {active && (
                              <span className="ml-auto shrink-0 text-xs font-bold text-app-brand-text">
                                                ✓
                                            </span>
                          )}
                        </button>
                    );
                  })}
                </div>
              </div>
          )}

          {step === 2 && (
              <div className="relative z-10">
                <h2 className="mb-1 text-base font-semibold text-app-text">
                  How experienced are you?
                </h2>

                <p className="mb-5 text-xs text-app-text-subtle">
                  This helps us adjust the depth of your onboarding path.
                </p>

                <div className="flex flex-col gap-2.5">
                  {LEVELS.map((level) => {
                    const active = wizard.level === level.value;

                    return (
                        <button
                            key={level.value}
                            type="button"
                            onClick={() =>
                                setWizard((current) => ({
                                  ...current,
                                  level: level.value,
                                }))
                            }
                            className={[
                              "flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus",
                              active
                                  ? "border-app-brand-border-strong bg-app-brand-soft shadow-lg"
                                  : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover",
                            ].join(" ")}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                                                <span className="text-[13px] font-semibold text-app-text">
                                                    {level.label}
                                                </span>

                              <span className="rounded-full bg-app-neutral-bg px-2 py-0.5 text-[9px] font-bold text-app-neutral-text">
                                                    {level.badge}
                                                </span>
                            </div>
                          </div>

                          {active && (
                              <span className="shrink-0 text-sm font-bold text-app-brand-text">
                                                ✓
                                            </span>
                          )}
                        </button>
                    );
                  })}
                </div>
              </div>
          )}

          {error && (
              <div className="relative z-10 mt-4 rounded-xl border border-app-danger-border bg-app-danger-bg px-3.5 py-2.5 text-xs text-app-danger-text">
                {error}
              </div>
          )}

          <div className="relative z-10 mt-6 flex items-center justify-between gap-3">
            {step === 2 ? (
                <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg px-1 py-2 text-xs font-medium text-app-text-subtle transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                >
                  ← Back
                </button>
            ) : (
                <div />
            )}

            {step === 1 ? (
                <button
                    type="button"
                    onClick={() => {
                      void handleContinue();
                    }}
                    disabled={!canProceed1 || loading}
                    className={[
                      "ml-auto flex min-w-[120px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus",
                      canProceed1 && !loading
                          ? "bg-app-brand text-white shadow-lg hover:bg-app-brand-hover"
                          : "cursor-not-allowed bg-app-surface-muted text-app-text-disabled",
                    ].join(" ")}
                >
                  {loading ? (
                      <>
                        <svg
                            className="h-3.5 w-3.5 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                          <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                          />
                          <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                        Saving…
                      </>
                  ) : (
                      "Continue →"
                  )}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleFinish}
                    disabled={!canFinish}
                    className={[
                      "ml-auto rounded-xl px-5 py-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus",
                      canFinish
                          ? "bg-app-brand text-white shadow-lg hover:bg-app-brand-hover"
                          : "cursor-not-allowed bg-app-surface-muted text-app-text-disabled",
                    ].join(" ")}
                >
                  Get started →
                </button>
            )}
          </div>
        </div>
      </div>
  );
}