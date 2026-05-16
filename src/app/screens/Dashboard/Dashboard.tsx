import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../components/ThemeProvider';
import { useRole } from '../../context/RoleContext';

type SortOption = 'progress' | 'startDate';
type Severity = 'critical' | 'medium';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { role } = useRole();
  const isMobile = useIsMobile();

  const [activeFilter, setActiveFilter] = useState(0);
  const [activeSrc, setActiveSrc] = useState(0);
  const [activeTopic, setActiveTopic] = useState(0);
  const [quickQuestion, setQuickQuestion] = useState('');
  const [onboardingSort, setOnboardingSort] = useState<SortOption>('progress');


  const isGerman = i18n.language.startsWith('de');
  const isDark = theme === 'dark';
  const showOnboardingProgress = role === 'Project Manager';

  const copy = isGerman
    ? {
        filters: ['Alle Projekte', 'Backend Core', 'Mobile App', 'Infrastructure'],
        srcFilters: ['Alle', 'Confluence', 'Jira', 'GitHub'],
        metrics: [
          { label: 'Ingested', value: '4.821', sub: 'Artefakte', color: '#22C55E' },
          { label: 'Updated', value: '312', sub: 'Letzter Lauf', color: '#3B82F6' },
          { label: 'Failed', value: '14', sub: 'Quellen', color: '#EF4444' },
          { label: 'Sources', value: '5 / 5', sub: 'Verbunden', color: '#14B8A6' },
          { label: 'Runtime', value: '23m', sub: 'vorher', color: '#8B5CF6' },
        ],
        sections: {
          gaps: 'Knowledge Gaps',
          actions: 'Action List',
          actionsBadge: 'empfohlene Verbesserungen',
          topTopics: 'Top Topics',
          usage: 'Usage Signals',
          freshness: 'Freshness',
          freshnessChart: 'Verteilung letzter Updates',
          onboarding: 'Onboarding Progress',
          quickChatTitle: 'Schnellfrage an den Chat',
          quickChatSubtitle: 'Frage direkt hier – der Text ist im Chat bereits vorgefüllt.',
        },
        labels: {
          severityCritical: 'kritisch',
          severityMedium: 'mittel',
          kbShort: '→',
          highPriority: '⬆ Hohe Priorität',
          mediumPriority: '⬇ Mittlere Priorität',
          askInChat: 'Im Chat fragen',
          openArtifact: '→',
          promptButton: 'Fragen',
          promptPlaceholder: 'z. B. Was ist der nächste Schritt für Jan?',
          sortBy: 'Sortierung',
          sortProgress: 'Progress',
          sortStartDate: 'Startdatum',
          sinceDays: 'seit',
          days: 'Tagen',
          started: 'Start',
          step: 'Step',
          total: 'Gesamt',
          detailView: '→ Detailansicht',
          navOverview: 'Übersicht',
          navGaps: 'Gaps',
          navActions: 'Actions',
          navOnboarding: 'Onboarding',
        },
        quickPrompts: [
          'Was blockiert den Abschluss von Kickoff-Schritten?',
          'Welche Artefakte sind für neue Teammitglieder kritisch?',
          'Was sind häufige Blocker in den ersten 30 Tagen?',
          'Welche Knowledge Gaps haben den größten Einfluss auf den Onboarding-Fortschritt?',
        ],
        usage: [
          { label: 'Wie deploye ich auf Staging?', count: 47, pct: 90 },
          { label: 'Welche Envs gibt es?', count: 38, pct: 72 },
          { label: 'Wer ist Owner von X?', count: 21, pct: 40 },
        ],
      }
    : {
        filters: ['All Projects', 'Backend Core', 'Mobile App', 'Infrastructure'],
        srcFilters: ['All', 'Confluence', 'Jira', 'GitHub'],
        metrics: [
          { label: 'Ingested', value: '4,821', sub: 'Artifacts', color: '#22C55E' },
          { label: 'Updated', value: '312', sub: 'Last Run', color: '#3B82F6' },
          { label: 'Failed', value: '14', sub: 'Sources', color: '#EF4444' },
          { label: 'Sources', value: '5 / 5', sub: 'Connected', color: '#14B8A6' },
          { label: 'Runtime', value: '23m', sub: 'ago', color: '#8B5CF6' },
        ],
        sections: {
          gaps: 'Knowledge Gaps',
          actions: 'Action List',
          actionsBadge: 'recommended improvements',
          topTopics: 'Top Topics',
          usage: 'Usage Signals',
          freshness: 'Freshness',
          freshnessChart: 'Last Updated Distribution',
          onboarding: 'Onboarding Progress',
          quickChatTitle: 'Quick chat entry',
          quickChatSubtitle: 'Ask here and land in chat with the question prefilled.',
        },
        labels: {
          severityCritical: 'critical',
          severityMedium: 'medium',
          kbShort: '→',
          highPriority: '⬆ High priority',
          mediumPriority: '⬇ Medium priority',
          askInChat: 'Ask in chat',
          openArtifact: '→',
          promptButton: 'Send',
          promptPlaceholder: 'e.g. What is Jan blocked by right now?',
          sortBy: 'Sort',
          sortProgress: 'Progress',
          sortStartDate: 'Start date',
          sinceDays: 'for',
          days: 'days',
          started: 'Start',
          step: 'Step',
          total: 'Overall',
          detailView: '→ Open details',
          navOverview: 'Overview',
          navGaps: 'Gaps',
          navActions: 'Actions',
          navOnboarding: 'Onboarding',
        },
        quickPrompts: [
          'What is blocking completion of kickoff steps?',
          'Which artifacts are critical for new team members?',
          'What are common blockers in the first 30 days?',
          'Which knowledge gaps most impact onboarding progress?',
        ],
        usage: [
          { label: 'How do I deploy to staging?', count: 47, pct: 90 },
          { label: 'What environments do we have?', count: 38, pct: 72 },
          { label: 'Who owns service X?', count: 21, pct: 40 },
        ],
      };

  const gaps = [
    { name: 'Payment Service', sub: isGerman ? 'kein Runbook vorhanden' : 'missing runbook', severity: 'critical' as Severity, link: '/knowledge?artifact=payment-service-runbook' },
    { name: 'Auth Module', sub: isGerman ? 'ADR fehlt' : 'ADR missing', severity: 'critical' as Severity, link: '/knowledge?artifact=auth-adr' },
    { name: 'CI/CD Pipeline', sub: isGerman ? 'Runbook veraltet' : 'runbook outdated', severity: 'medium' as Severity, link: '/knowledge?artifact=cicd-runbook' },
    { name: 'Notification Service', sub: isGerman ? 'kein Owner' : 'no owner assigned', severity: 'medium' as Severity, link: '/knowledge?artifact=notification-service' },
  ];

  const actions = [
    { text: isGerman ? 'Runbook für Payment Service erstellen' : 'Create runbook for Payment Service', high: true, chatQuestion: isGerman ? 'Kannst du ein Runbook-Gerüst für den Payment Service vorbereiten?' : 'Can you draft a runbook template for the Payment Service?', artifactLink: '/knowledge?artifact=payment-service-runbook' },
    { text: isGerman ? 'Owner für Auth Module eintragen' : 'Assign owner for Auth Module', high: true, chatQuestion: isGerman ? 'Wer sollte Owner für das Auth Module sein und warum?' : 'Who should own the Auth Module and why?', artifactLink: '/knowledge?artifact=auth-ownership' },
    { text: isGerman ? 'CI/CD Runbook aktualisieren' : 'Refresh CI/CD runbook', high: false, chatQuestion: isGerman ? 'Welche Schritte im CI/CD Runbook sind vermutlich veraltet?' : 'Which CI/CD runbook steps are likely outdated?', artifactLink: '/knowledge?artifact=cicd-runbook' },
  ];

  const topics = [
    { label: 'Auth & Security', count: 84, color: '#3B82F6' },
    { label: 'Deployment', count: 61, color: '#22C55E' },
    { label: 'CI/CD', count: 47, color: '#8B5CF6' },
    { label: 'API Design', count: 39, color: '#14B8A6' },
    { label: 'Monitoring', count: 28, color: '#F59E0B' },
  ];

  const stale = [
    { name: 'CI/CD Runbook', age: isGerman ? '8 Monate' : '8 months', link: '/knowledge?artifact=cicd-runbook' },
    { name: 'Deployment Guide v2', age: isGerman ? '6 Monate' : '6 months', link: '/knowledge?artifact=deployment-guide-v2' },
    { name: isGerman ? 'Onboarding Checkliste' : 'Onboarding Checklist', age: isGerman ? '4 Monate' : '4 months', link: '/knowledge?artifact=onboarding-checklist' },
  ];

  const onboardingSteps = isGerman
    ? ['Kickoff', 'Docs lesen', 'Erstes PR', 'Code Review', 'Abschluss']
    : ['Kickoff', 'Read docs', 'First PR', 'Code review', 'Wrap-up'];

  const members = [
    { initials: 'LM', name: 'Lisa Müller', role: isGerman ? 'Frontend Entwicklerin' : 'Frontend Engineer', pct: 35, color: '#3B82F6', step: 1, daysSince: 12, startDate: '2026-05-02', link: '/onboarding' },
    { initials: 'TK', name: 'Tom Koch', role: isGerman ? 'Backend Entwickler' : 'Backend Engineer', pct: 72, color: '#14B8A6', step: 3, daysSince: 8, startDate: '2026-05-06', link: '/onboarding' },
    { initials: 'SR', name: 'Sara Ruiz', role: 'PM', pct: 58, color: '#8B5CF6', step: 2, daysSince: 5, startDate: '2026-05-09', link: '/onboarding' },
    { initials: 'JB', name: 'Jan Berger', role: 'DevOps', pct: 12, color: '#F59E0B', step: 0, daysSince: 3, startDate: '2026-05-11', link: '/onboarding' },
  ];

  const C = isDark
    ? { bg: '#000000', surface: '#0D1117', surface2: '#111827', surface3: '#0A0F1A', border: '#1F2937', text: '#F9FAFB', sub: '#9CA3AF', blue: '#3B82F6', blueSoft: 'rgba(59,130,246,0.12)', green: '#22C55E', amber: '#F59E0B', red: '#EF4444', purple: '#8B5CF6', teal: '#14B8A6', hoverCard: '#161f2e' }
    : { bg: '#F3F7FC', surface: '#FFFFFF', surface2: '#F8FAFC', surface3: '#E2E8F0', border: '#DCE5F1', text: '#0F172A', sub: '#64748B', blue: '#2563EB', blueSoft: 'rgba(37,99,235,0.1)', green: '#16A34A', amber: '#D97706', red: '#DC2626', purple: '#7C3AED', teal: '#0F766E', hoverCard: '#EEF4FF' };

  const openChatWithQuestion = (question: string) => {
    const encoded = encodeURIComponent(question.trim());
    if (!encoded) return;
    navigate(`/?question=${encoded}`);
  };

  const submitQuickQuestion = () => openChatWithQuestion(quickQuestion);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (onboardingSort === 'progress') return b.pct - a.pct;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [onboardingSort, isGerman]);

  // ─── Shared card style helper ───────────────────────────────────────────────
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'relative',
    overflow: 'hidden',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: isMobile ? 20 : 28,
    padding: isMobile ? 16 : 20,
    boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)',
    ...extra,
  });

  // ─── MOBILE RENDER ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ background: C.bg, minHeight: '100dvh', fontFamily: '"DM Sans", Inter, sans-serif', color: C.text, overflowX: 'hidden' }}>
        <div style={{ padding: '14px 14px 40px' }}>

          {/* ── Compact metric chips — single scrollable row ── */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 14, scrollbarWidth: 'none' }}>
            {copy.metrics.map((m) => (
              <div key={m.label} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, padding: '5px 10px 5px 8px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{m.value}</span>
                <span style={{ fontSize: 10, color: C.sub }}>{m.sub || m.label}</span>
              </div>
            ))}
          </div>

          {/* ── Knowledge Gaps ── */}
          <div style={{ ...card(), marginBottom: 12 }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(239,68,68,0.07)', filter: 'blur(40px)' }} />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{copy.sections.gaps}</div>
            {gaps.map((g) => (
              <a key={g.name} href={g.link} style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '10px 8px', marginBottom: 4, borderRadius: 12, border: '1px solid transparent', transition: 'all 0.15s' }}
                onTouchStart={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)'; }}
                onTouchEnd={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: C.sub }}>{g.sub}</div>
                  </div>
                  <div style={{ background: g.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: g.severity === 'critical' ? '#FCA5A5' : '#FCD34D', fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 600, flexShrink: 0 }}>
                    {g.severity === 'critical' ? copy.labels.severityCritical : copy.labels.severityMedium}
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* ── Action List ── */}
          <div style={{ ...card(), marginBottom: 12 }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59,130,246,0.06)', filter: 'blur(40px)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{copy.sections.actions}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 999, padding: '3px 8px' }}>
                <span style={{ fontSize: 9 }}>✦</span>
                <span style={{ fontSize: 10, color: '#C4B5FD', fontWeight: 500 }}>{copy.sections.actionsBadge}</span>
              </div>
            </div>
            {actions.map((a, i) => (
              <div key={a.text} style={{ paddingBottom: 12, marginBottom: i < actions.length - 1 ? 12 : 0, borderBottom: i < actions.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#E9EFF8'}` : 'none' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ marginTop: 4, flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: a.high ? C.red : C.amber, boxShadow: `0 0 5px ${a.high ? C.red : C.amber}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>{a.text}</div>
                    <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{a.high ? copy.labels.highPriority : copy.labels.mediumPriority}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={a.artifactLink} style={{ flex: 1, textAlign: 'center', border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px', fontSize: 11, color: C.sub, textDecoration: 'none', background: C.surface2 }}>→</a>
                  <button onClick={() => openChatWithQuestion(a.chatQuestion)} style={{ flex: 3, border: `1px solid ${C.blue}`, borderRadius: 10, padding: '7px', fontSize: 11, color: C.blue, background: 'transparent', cursor: 'pointer' }}>
                    {copy.labels.askInChat}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {showOnboardingProgress && (
            <>
              {/* ── Onboarding Progress ── */}
              <div style={{ ...card(), marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{copy.sections.onboarding}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['progress', 'startDate'] as SortOption[]).map((s) => (
                      <button key={s} onClick={() => setOnboardingSort(s)} style={{ border: `1px solid ${onboardingSort === s ? `${C.blue}66` : C.border}`, borderRadius: 999, background: onboardingSort === s ? C.blueSoft : C.surface, color: onboardingSort === s ? C.blue : C.sub, fontSize: 10, padding: '4px 9px', cursor: 'pointer' }}>
                        {s === 'progress' ? copy.labels.sortProgress : copy.labels.sortStartDate}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedMembers.map((m) => (
                    <a key={m.name} href={m.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${m.color}22`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, border: `1.5px solid ${m.color}44` }}>{m.initials}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                            <div style={{ fontSize: 10, color: C.sub }}>{m.role}</div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.pct}%</div>
                        </div>
                        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                          {onboardingSteps.map((step, si) => (
                            <div key={step} title={step} style={{ flex: 1, height: 4, borderRadius: 999, background: si < m.step ? m.color : si === m.step ? `${m.color}99` : isDark ? 'rgba(255,255,255,0.07)' : '#DDE6F2' }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: C.sub }}>
                          {copy.labels.step} {m.step + 1}/5: <span style={{ color: m.color }}>{onboardingSteps[m.step]}</span>
                          <span style={{ marginLeft: 8, opacity: 0.7 }}>· {copy.labels.sinceDays} {m.daysSince} {copy.labels.days}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Top Topics + Usage ── */}
          <div style={{ ...card(), marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{copy.sections.topTopics}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {topics.map((t, i) => (
                <button key={t.label} onClick={() => setActiveTopic(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 999, border: `1px solid ${i === activeTopic ? `${t.color}66` : C.border}`, background: i === activeTopic ? `${t.color}12` : C.surface, padding: '4px 10px 4px 6px', cursor: 'pointer' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${t.color}22`, color: t.color, fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.count}</span>
                  <span style={{ fontSize: 10, color: i === activeTopic ? C.text : C.sub }}>{t.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 10, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#E9EFF8'}`, paddingTop: 10 }}>{copy.sections.usage}</div>
            {copy.usage.map((u) => (
              <div key={u.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span>{u.label}</span>
                  <span style={{ background: 'rgba(59,130,246,0.12)', color: isDark ? '#93C5FD' : '#2563EB', fontSize: 10, padding: '2px 7px', borderRadius: 999 }}>{u.count}×</span>
                </div>
                <div style={{ height: 4, background: isDark ? '#111827' : '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${u.pct}%`, height: '100%', background: 'linear-gradient(90deg,#3B82F6,#60A5FA)' }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Freshness ── */}
          <div style={card()}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{copy.sections.freshness}</div>
            {stale.map((r, i) => (
              <a key={r.name} href={r.link} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', textDecoration: 'none', color: 'inherit', borderBottom: i < stale.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#E9EFF8'}` : 'none' }}>
                <span style={{ fontSize: 12 }}>{r.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#FCA5A5', flexShrink: 0 }}>{r.age}</span>
                  <span style={{ fontSize: 10, color: C.blue }}>→</span>
                </div>
              </a>
            ))}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: C.sub, marginBottom: 6 }}>{copy.sections.freshnessChart}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 48 }}>
                {[{ h: 35, color: '#22C55E' }, { h: 60, color: '#3B82F6' }, { h: 90, color: '#F59E0B' }, { h: 55, color: '#EF4444' }].map((b, i) => (
                  <div key={i} style={{ flex: 1, height: `${b.h}%`, borderRadius: '4px 4px 0 0', background: b.color, opacity: 0.85 }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 4, fontSize: 9, color: C.sub }}>
                {['<1M', '1-3M', '3-6M', '>6M'].map((l) => <span key={l} style={{ flex: 1 }}>{l}</span>)}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ─── DESKTOP RENDER (original layout, unverändert) ───────────────────────────
  return (
    <div
      style={{
        background: C.bg,
        minHeight: '100vh',
        padding: '28px 32px 64px',
        fontFamily: '"DM Sans", Inter, sans-serif',
        color: C.text,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: isDark
            ? 'radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 30%), radial-gradient(circle at top right, rgba(139,92,246,0.08), transparent 30%)'
            : 'radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at top right, rgba(124,58,237,0.1), transparent 35%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Filter bar ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {copy.filters.map((f, i) => (
            <button
              key={f}
              onClick={() => setActiveFilter(i)}
              style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1px solid ${i === activeFilter ? 'rgba(59,130,246,0.4)' : C.border}`, background: i === activeFilter ? C.blueSoft : C.surface, color: i === activeFilter ? (isDark ? '#93C5FD' : '#2563EB') : C.sub, transition: 'all 0.2s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}55, 0 0 14px ${C.blue}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {copy.srcFilters.map((f, i) => (
            <button
              key={f}
              onClick={() => setActiveSrc(i)}
              style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1px solid ${i === activeSrc ? 'rgba(20,184,166,0.4)' : C.border}`, background: i === activeSrc ? 'rgba(20,184,166,0.1)' : C.surface, color: i === activeSrc ? '#0EA5A4' : C.sub, transition: 'all 0.2s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 1px ${C.teal}55, 0 0 14px ${C.teal}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Metrics row ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 14, marginBottom: 20 }}>
        {copy.metrics.map((m) => (
          <div key={m.label} style={{ position: 'relative', overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 22, padding: '18px 18px 16px', minHeight: 88, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: m.color, opacity: 0.12, filter: 'blur(45px)' }} />
            <div style={{ fontSize: 10, color: C.sub, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.8 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Four-column section ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '0.85fr 1fr 1.2fr 1fr', gap: 18, marginBottom: 20, alignItems: 'start' }}>
        {/* Knowledge Gaps */}
        <div style={{ position: 'relative', overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 20, boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(239,68,68,0.07)', filter: 'blur(60px)' }} />
          <div style={{ position: 'relative', zIndex: 2, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{copy.sections.gaps}</div>
          {gaps.map((g) => (
            <a key={g.name} href={g.link} style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '11px 10px', marginBottom: 4, borderRadius: 12, background: 'transparent', border: '1px solid transparent', transition: 'all 0.18s', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.4 }}>{g.sub}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ background: g.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: g.severity === 'critical' ? '#FCA5A5' : '#FCD34D', fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {g.severity === 'critical' ? copy.labels.severityCritical : copy.labels.severityMedium}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: C.blue, opacity: 0.85 }}>{copy.labels.kbShort}</div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Action List */}
        <div style={{ position: 'relative', overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 20, boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(59,130,246,0.07)', filter: 'blur(60px)' }} />
          <div style={{ position: 'relative', zIndex: 2, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{copy.sections.actions}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 999, padding: '4px 10px', marginBottom: 16 }}>
            <span style={{ fontSize: 10 }}>✦</span>
            <span style={{ fontSize: 11, color: '#C4B5FD', fontWeight: 500 }}>{copy.sections.actionsBadge}</span>
          </div>
          {actions.map((a, i) => (
            <div key={a.text} style={{ padding: '11px 0', borderBottom: i < actions.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#E9EFF8'}` : 'none' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ marginTop: 3, flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: a.high ? C.red : C.amber, boxShadow: `0 0 6px ${a.high ? C.red : C.amber}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>{a.text}</div>
                  <div style={{ fontSize: 10, color: C.sub, marginTop: 3 }}>{a.high ? copy.labels.highPriority : copy.labels.mediumPriority}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  <a
                    href={a.artifactLink}
                    style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '4px 10px', fontSize: 10, color: C.sub, textDecoration: 'none', background: C.surface, transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}44, 0 0 12px ${C.blue}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {copy.labels.openArtifact}
                  </a>
                  <button
                    onClick={() => openChatWithQuestion(a.chatQuestion)}
                    style={{ border: `1px solid ${C.blue}`, borderRadius: 10, padding: '4px 10px', fontSize: 10, color: C.blue, background: 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}66, 0 0 14px ${C.blue}35`;
                      e.currentTarget.style.background = `${C.blue}12`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {copy.labels.askInChat}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Topics + Usage */}
        <div style={{ position: 'relative', overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 20, boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(59,130,246,0.07)', filter: 'blur(60px)' }} />
          <div style={{ position: 'relative', zIndex: 2, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{copy.sections.topTopics}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {topics.map((t, i) => (
              <button key={t.label} onClick={() => setActiveTopic(i)} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 999, border: `1px solid ${i === activeTopic ? `${t.color}66` : C.border}`, background: i === activeTopic ? `${t.color}12` : C.surface, padding: '5px 10px 5px 6px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 0 1px ${t.color}40, 0 0 14px ${t.color}33`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${t.color}22`, color: t.color, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.count}</span>
                <span style={{ fontSize: 11, color: i === activeTopic ? C.text : C.sub }}>{t.label}</span>
              </button>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#E9EFF8'}`, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ position: 'relative', top: -1, padding: '0 8px', fontSize: 10, color: C.sub, background: C.surface, marginTop: -1 }}>{copy.sections.usage}</span>
          </div>
          {copy.usage.map((u) => (
            <div key={u.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: C.text }}>{u.label}</span>
                <span style={{ background: 'rgba(59,130,246,0.12)', color: isDark ? '#93C5FD' : '#2563EB', fontSize: 10, padding: '2px 7px', borderRadius: 999 }}>{u.count}×</span>
              </div>
              <div style={{ height: 5, background: isDark ? '#111827' : '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${u.pct}%`, height: '100%', background: 'linear-gradient(90deg, #3B82F6, #60A5FA)' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Freshness */}
        <div style={{ position: 'relative', overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 20, boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 150, height: 150, borderRadius: '50%', background: 'rgba(245,158,11,0.07)', filter: 'blur(60px)' }} />
          <div style={{ position: 'relative', zIndex: 2, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{copy.sections.freshness}</div>
          {stale.map((r, i) => (
            <a
              key={r.name}
              href={r.link}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 8px', textDecoration: 'none', color: 'inherit', borderBottom: i < stale.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#E9EFF8'}` : 'none', borderRadius: 10, transition: 'all 0.2s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${C.amber}12`;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${C.amber}44, 0 0 14px ${C.amber}2A`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: 12 }}>{r.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#FCA5A5', flexShrink: 0 }}>{r.age}</span>
                <span style={{ fontSize: 10, color: C.blue }}>{copy.labels.openArtifact}</span>
              </div>
            </a>
          ))}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>{copy.sections.freshnessChart}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72 }}>
              {[{ h: 35, color: '#22C55E' }, { h: 60, color: '#3B82F6' }, { h: 90, color: '#F59E0B' }, { h: 55, color: '#EF4444' }].map((b, i) => (
                <div key={i} style={{ flex: 1, height: `${b.h}%`, borderRadius: '6px 6px 0 0', background: b.color, opacity: 0.85 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 10, color: C.sub }}>
              {['<1M', '1-3M', '3-6M', '>6M'].map((l) => <span key={l} style={{ flex: 1 }}>{l}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Chat ── */}
      <div style={{ position: 'relative', zIndex: 2, overflow: 'hidden', background: isDark ? 'linear-gradient(135deg, #111827 0%, #0f172a 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)', border: `1px solid ${isDark ? '#1e293b' : '#dbeafe'}`, borderRadius: 22, padding: 18, marginBottom: 14, boxShadow: isDark ? '0 12px 30px rgba(2,6,23,0.45)' : '0 12px 28px rgba(37,99,235,0.12)' }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${C.blue}20`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✦</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{copy.sections.quickChatTitle}</div>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 12 }}>{copy.sections.quickChatSubtitle}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={quickQuestion} onChange={(e) => setQuickQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitQuickQuestion()} placeholder={copy.labels.promptPlaceholder} style={{ flex: 1, borderRadius: 12, border: `1px solid ${isDark ? '#334155' : '#bfdbfe'}`, background: isDark ? '#0B1220' : '#FFFFFF', color: C.text, fontSize: 12, padding: '10px 12px', outline: 'none' }} />
            <button
              onClick={submitQuickQuestion}
              style={{ borderRadius: 12, border: 'none', background: C.blue, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '10px 14px', boxShadow: '0 6px 14px rgba(37,99,235,0.35)', transition: 'all 0.2s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}66, 0 0 16px ${C.blue}4D`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 14px rgba(37,99,235,0.35)';
              }}
            >
              {copy.labels.promptButton}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {copy.quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => openChatWithQuestion(prompt)}
                style={{ border: `1px solid ${isDark ? '#334155' : '#bfdbfe'}`, background: isDark ? '#111827' : '#ffffff', color: C.sub, borderRadius: 999, fontSize: 10, padding: '5px 11px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}55, 0 0 14px ${C.blue}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showOnboardingProgress && (
        <>
          {/* ── Onboarding ── */}
          <div style={{ position: 'relative', zIndex: 2, overflow: 'hidden', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 22, boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : '0 8px 25px rgba(15,23,42,0.05)' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(59,130,246,0.07)', filter: 'blur(80px)' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{copy.sections.onboarding}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: C.sub }}>{copy.labels.sortBy}</span>
                {(['progress', 'startDate'] as SortOption[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setOnboardingSort(s)}
                    style={{ border: `1px solid ${onboardingSort === s ? `${C.blue}66` : C.border}`, borderRadius: 999, background: onboardingSort === s ? C.blueSoft : C.surface, color: onboardingSort === s ? C.blue : C.sub, fontSize: 11, padding: '5px 10px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = `0 0 0 1px ${C.blue}55, 0 0 14px ${C.blue}33`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {s === 'progress' ? copy.labels.sortProgress : copy.labels.sortStartDate}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {sortedMembers.map((m) => (
                <a key={m.name} href={m.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 22, padding: 18, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${m.color}55`; e.currentTarget.style.background = C.hoverCard; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: `${m.color}22`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, border: `1.5px solid ${m.color}44` }}>{m.initials}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: C.sub }}>{m.role}</div>
                      </div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9', borderRadius: 999, padding: '3px 9px', fontSize: 10, color: C.sub, marginBottom: 14 }}>
                      <span style={{ opacity: 0.6 }}>⏱</span> {copy.labels.sinceDays} {m.daysSince} {copy.labels.days} • {copy.labels.started} {new Date(m.startDate).toLocaleDateString(isGerman ? 'de-DE' : 'en-US', { day: '2-digit', month: 'short' })}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {onboardingSteps.map((step, si) => (
                        <div key={step} title={step} style={{ flex: 1, height: 5, borderRadius: 999, background: si < m.step ? m.color : si === m.step ? `${m.color}99` : isDark ? 'rgba(255,255,255,0.07)' : '#DDE6F2' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 10 }}>{copy.labels.step} {m.step + 1}/5: <span style={{ color: m.color }}>{onboardingSteps[m.step]}</span></div>
                    <div style={{ height: 5, background: isDark ? '#0A0F1A' : '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${m.pct}%`, height: '100%', background: `linear-gradient(90deg, ${m.color}, ${m.color}BB)` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: C.sub }}>
                      <span>{copy.labels.total}</span>
                      <span style={{ color: m.color }}>{m.pct}%</span>
                    </div>
                    <div style={{ marginTop: 12, fontSize: 10, color: C.blue, opacity: 0.8 }}>{copy.labels.detailView}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}