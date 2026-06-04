import { useState } from "react";
import { userService } from "../features/onboarding/api/userService";
import { WorkingArea } from "../services/types";
import { useAuth } from "../context/useAuth";

type Level = "Beginner" | "Intermediate" | "Advanced";

interface WizardState {
  workingArea: WorkingArea | null;
  level: Level | null;
}

function RoleIcon({ icon }: { icon: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
      fontSize: 18, flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

const ROLES: { value: WorkingArea; label: string; icon: string; description: string }[] = [
  { value: WorkingArea.BACKEND_DEV,  label: "Backend Developer",  icon: "🖥️", description: "Server-side logic, databases & APIs"        },
  { value: WorkingArea.FRONTEND_DEV, label: "Frontend Developer", icon: "🌐", description: "User interfaces, client-side logic & design" },
  { value: WorkingArea.HR,           label: "HR",                 icon: "🩵", description: "People, culture & hiring"                   },
  { value: WorkingArea.QA,           label: "QA Engineer",        icon: "🔍", description: "Testing, quality & automation"              },
  { value: WorkingArea.DEV_OPS,      label: "DevOps Engineer",    icon: "♾️", description: "Infrastructure, deployment & CI/CD"         },
];

const LEVELS: { value: Level; label: string; badge: string }[] = [
  { value: "Beginner",     label: "Beginner",     badge: "New here"      },
  { value: "Intermediate", label: "Intermediate", badge: "Some reps"     },
  { value: "Advanced",     label: "Advanced",     badge: "Battle-tested" },
];


const C = {
  surface:  "#0D1117",
  surface2: "#111827",
  border:   "#1F2937",
  text:     "#F9FAFB",
  sub:      "#9CA3AF",
  blue:     "#3B82F6",
  blueSoft: "rgba(59,130,246,0.12)",
  shadow:   "inset 0 1px 0 rgba(255,255,255,0.03)",
};

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
      {[1, 2].map((s) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, transition: "all 0.25s",
            background: s === step ? C.blue : s < step ? "rgba(59,130,246,0.2)" : C.surface2,
            color:      s === step ? "#fff"  : s < step ? C.blue                : C.sub,
            boxShadow:  s === step ? "0 0 14px rgba(59,130,246,0.4)" : "none",
          }}>
            {s < step ? "✓" : s}
          </div>
          <span style={{ fontSize: 11, color: s === step ? C.blue : C.sub, transition: "color 0.2s" }}>
            {s === 1 ? "Your role" : "Experience"}
          </span>
          {s < 2 && <div style={{ width: 28, height: 1, background: C.border, margin: "0 4px" }} />}
        </div>
      ))}
    </div>
  );
}


export function SelectionWizardPage({ open = true }: { open?: boolean } = {}) {
  const { refetchProfile } = useAuth();
  const [step, setStep]       = useState<1 | 2>(1);
  const [wizard, setWizard]   = useState<WizardState>({ workingArea: null, level: null });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (!open) return null;

  const canProceed1 = wizard.workingArea !== null;

  // Step 1: 
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

  // Step 2: 
    const canFinish = wizard.level !== null;

    // navigate to /onboarding
    function handleFinish() {
     window.location.href = "/onboarding";
    }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Role selection"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div style={{
        position: "relative", overflow: "hidden",
        width: "100%", maxWidth: 520,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 28,
        padding: "28px 28px 24px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "rgba(59,130,246,0.08)", filter: "blur(70px)",
          pointerEvents: "none",
        }} />

        {/* Header */}
        <div style={{ position: "relative", zIndex: 2, marginBottom: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>
            Setup your profile
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 2 }}>
          <StepIndicator step={step} />
        </div>

        {/* Step 1 — Role */}
        {step === 1 && (
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              What&apos;s your primary role?
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 18 }}>
              We&apos;ll tailor your onboarding path to fit how you actually work.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {ROLES.map((r) => {
                const active = wizard.workingArea === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => setWizard((w) => ({ ...w, workingArea: r.value }))}
                    className="focus-visible:focus-outline outline-none"
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, padding: "12px",
                      borderRadius: 16,
                      border: `1px solid ${active ? `${C.blue}99` : C.border}`,
                      background: active ? C.blueSoft : C.surface2,
                      cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                      boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 14px rgba(59,130,246,0.15)" : C.shadow,
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = `${C.blue}55`; e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}33, 0 0 14px rgba(59,130,246,0.12)`; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = C.shadow; } }}
                  >
                    <RoleIcon icon={r.icon} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 10, color: C.sub, lineHeight: 1.4 }}>{r.description}</div>
                    </div>
                    {active && <span style={{ color: C.blue, fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: "auto" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — Level (UI only, not saved yet) */}
        {step === 2 && (
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              How experienced are you?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LEVELS.map((l) => {
                const active = wizard.level === l.value;
                return (
                  <button
                    key={l.value}
                    onClick={() => setWizard((w) => ({ ...w, level: l.value }))}
                    className="focus-visible:focus-outline outline-none"
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                      borderRadius: 16,
                      border: `1px solid ${active ? `${C.blue}99` : C.border}`,
                      background: active ? C.blueSoft : C.surface2,
                      cursor: "pointer", textAlign: "left", transition: "all 0.18s",
                      boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 14px rgba(59,130,246,0.15)" : C.shadow,
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = `${C.blue}55`; e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}33, 0 0 14px rgba(59,130,246,0.12)`; } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = C.shadow; } }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{l.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.04)", color: C.sub }}>
                          {l.badge}
                        </span>
                      </div>
                    </div>
                    {active && <span style={{ color: C.blue, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 12,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            fontSize: 12, color: "#FCA5A5", position: "relative", zIndex: 2,
          }}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 24, gap: 12,
        }}>
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="focus-visible:focus-outline outline-none rounded-md"
              style={{ fontSize: 12, fontWeight: 500, color: C.sub, background: "transparent", border: "none", cursor: "pointer", padding: "8px 4px", transition: "color 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.sub; }}
            >
              ← Back
            </button>
          ) : <div />}

          {step === 1 ? (
            <button
                onClick={() => {
                  void (async () => {
                    await handleContinue();
                  })();
                }}
              disabled={!canProceed1 || loading}
              className="focus-visible:focus-outline outline-none"
              style={{
                marginLeft: "auto", padding: "10px 22px", borderRadius: 12, border: "none",
                fontSize: 12, fontWeight: 700,
                minWidth: 120, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: canProceed1 && !loading ? "pointer" : "not-allowed", transition: "all 0.2s",
                background: canProceed1 && !loading ? C.blue : C.surface2,
                color:      canProceed1 && !loading ? "#fff"  : C.sub,
                boxShadow:  canProceed1 && !loading ? "0 6px 14px rgba(59,130,246,0.35)" : "none",
              }}
              onMouseEnter={(e) => { if (canProceed1 && !loading) e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}66, 0 0 16px rgba(59,130,246,0.4)`; }}
              onMouseLeave={(e) => { if (canProceed1 && !loading) e.currentTarget.style.boxShadow = "0 6px 14px rgba(59,130,246,0.35)"; }}
            >
              {loading ? (
                <>
                  <svg style={{ animation: "spin 1s linear infinite", width: 14, height: 14 }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : "Continue →"}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canFinish}
              className="focus-visible:focus-outline outline-none"
              style={{
                marginLeft: "auto", padding: "10px 22px", borderRadius: 12, border: "none",
                fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                background: C.blue, color: "#fff",
                boxShadow: canFinish ? "0 6px 14px rgba(59,130,246,0.35)" : "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}66, 0 0 16px rgba(59,130,246,0.4)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 6px 14px rgba(59,130,246,0.35)"; }}
            >
              Get started →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}