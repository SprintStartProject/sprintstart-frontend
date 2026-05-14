export function Dashboard() {
  const metrics = [
    { label: 'Ingested', value: '4.821', sub: 'Artifacts', color: '#22C55E' },
    { label: 'Updated', value: '312', sub: 'Last Run', color: '#3B82F6' },
    { label: 'Failed', value: '14', sub: 'Sources', color: '#EF4444' },
    { label: 'Sources', value: '5 / 5', sub: 'Connected', color: '#14B8A6' },
    { label: 'Runtime', value: '23m', sub: 'ago', color: '#8B5CF6' },
  ];

  const gaps = [
    { name: 'Payment Service', sub: 'kein Runbook vorhanden', severity: 'kritisch' },
    { name: 'Auth Module', sub: 'ADR fehlt', severity: 'kritisch' },
    { name: 'CI/CD Pipeline', sub: 'Runbook veraltet', severity: 'mittel' },
    { name: 'Notification Service', sub: 'kein Owner', severity: 'mittel' },
  ];

  const actions = [
    { text: 'Runbook für Payment Service erstellen', high: true },
    { text: 'Owner für Auth Module eintragen', high: true },
    { text: 'CI/CD Runbook aktualisieren', high: false },
    { text: 'ADR dokumentieren', high: false },
  ];

  const topics = [
    'Auth & Security',
    'Deployment',
    'CI/CD',
    'API Design',
  ];

  const usage = [
    { label: 'Wie deploye ich auf Staging?', count: 47, pct: 90 },
    { label: 'Welche Envs gibt es?', count: 38, pct: 72 },
    { label: 'Wer ist Owner von X?', count: 21, pct: 40 },
  ];

  const stale = [
    { name: 'CI/CD Runbook', age: '8 Monate' },
    { name: 'Deployment Guide v2', age: '6 Monate' },
    { name: 'Onboarding Checkliste', age: '4 Monate' },
  ];

  const members = [
    { initials: 'LM', name: 'Lisa Müller', role: 'Frontend Dev', pct: 35, color: '#3B82F6' },
    { initials: 'TK', name: 'Tom Koch', role: 'Backend Dev', pct: 72, color: '#14B8A6' },
    { initials: 'SR', name: 'Sara Ruiz', role: 'PM', pct: 58, color: '#8B5CF6' },
    { initials: 'JB', name: 'Jan Berger', role: 'DevOps', pct: 12, color: '#F59E0B' },
  ];

  const filters = [
    'Alle Projekte',
    'Backend Core',
    'Mobile App',
    'Infrastructure',
  ];

  const srcFilters = [
    'Alle',
    'Confluence',
    'Jira',
    'GitHub',
  ];

  const C = {
    bg: '#000000',

    surface: '#0D1117',
    surface2: '#111827',

    border: '#1F2937',

    text: '#F9FAFB',
    sub: '#9CA3AF',

    blue: '#3B82F6',
    blueSoft: 'rgba(59,130,246,0.12)',

    green: '#22C55E',
    amber: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6',
    teal: '#14B8A6',
  };

  const s = {
    wrap: {
      background: C.bg,

      minHeight: '100vh',

      padding: 32,
      paddingBottom: 64,

      fontFamily: 'Inter, sans-serif',
      color: C.text,

      overflowY: 'auto',
      overflowX: 'hidden',
    },

    // TOP

    topbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',

      gap: 24,

      marginBottom: 22,

      flexWrap: 'wrap',
    },

    // METRICS

    metricGrid: {
      display: 'grid',

      gridTemplateColumns: 'repeat(5, minmax(125px, 1fr))',

      gap: 14,

      flex: 1,
    },

    metricCard: (color) => ({
      position: 'relative',

      overflow: 'hidden',

      background: C.surface,

      border: `1px solid ${C.border}`,
      borderRadius: 24,

      padding: '18px 18px 16px',

      minHeight: 90,

      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',

      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.03),
        0 0 0 1px rgba(255,255,255,0.015)
      `,
    }),

    metricGlow: (color) => ({
      position: 'absolute',

      top: -30,
      right: -30,

      width: 100,
      height: 100,

      borderRadius: '50%',

      background: color,

      opacity: 0.12,

      filter: 'blur(45px)',
    }),

    metricLabel: {
      fontSize: 11,

      color: C.sub,

      marginBottom: 8,

      textTransform: 'uppercase',

      letterSpacing: 0.7,
    },

    metricValue: {
      fontSize: 28,

      fontWeight: 700,

      lineHeight: 1,
    },

    metricSub: {
      fontSize: 12,

      color: C.sub,

      marginTop: 7,
    },

    // FILTERS

    filterArea: {
      display: 'flex',

      flexDirection: 'column',

      gap: 10,

      minWidth: 300,

      alignItems: 'flex-end',
    },

    filterRow: {
      display: 'flex',

      gap: 8,

      flexWrap: 'wrap',

      justifyContent: 'flex-end',
    },

    chip: (active) => ({
      padding: '7px 13px',

      borderRadius: 999,

      fontSize: 12,

      border: `1px solid ${
        active
          ? 'rgba(59,130,246,0.4)'
          : C.border
      }`,

      background: active
        ? C.blueSoft
        : C.surface,

      color: active
        ? '#93C5FD'
        : C.sub,

      transition: '0.2s',

      cursor: 'pointer',
    }),

    // GRID

    grid: {
      display: 'grid',

      gridTemplateColumns: '1fr 1fr 1.15fr 1fr',

      gap: 18,

      marginBottom: 22,

      alignItems: 'start',
    },

    // CARD

    card: {
      position: 'relative',

      overflow: 'hidden',

      background: C.surface,

      border: `1px solid ${C.border}`,

      borderRadius: 30,

      padding: 22,

      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.03),
        0 0 0 1px rgba(255,255,255,0.015)
      `,
    },

    cardGlow: {
      position: 'absolute',

      top: -60,
      right: -60,

      width: 170,
      height: 170,

      borderRadius: '50%',

      background: 'rgba(59,130,246,0.08)',

      filter: 'blur(70px)',
    },

    cardTitle: {
      position: 'relative',

      zIndex: 2,

      fontSize: 15,

      fontWeight: 600,

      marginBottom: 20,
    },

    // ROWS

    itemRow: {
      display: 'flex',

      justifyContent: 'space-between',

      gap: 14,

      padding: '12px 0',

      borderBottom: '1px solid rgba(255,255,255,0.04)',
    },

    sub: {
      fontSize: 12,

      color: C.sub,

      marginTop: 5,

      lineHeight: 1.45,
    },

    // BADGES

    badge: (sev) => ({
      background:
        sev === 'kritisch'
          ? 'rgba(239,68,68,0.12)'
          : 'rgba(245,158,11,0.12)',

      color:
        sev === 'kritisch'
          ? '#FCA5A5'
          : '#FCD34D',

      fontSize: 11,

      padding: '5px 10px',

      borderRadius: 999,

      fontWeight: 600,

      height: 'fit-content',
    }),

    // PROGRESS

    progressTrack: {
      width: '100%',

      height: 7,

      background: '#111827',

      borderRadius: 999,

      overflow: 'hidden',

      marginTop: 8,
    },

    // ONBOARDING

    onboardingGrid: {
      display: 'grid',

      gridTemplateColumns: 'repeat(4, 1fr)',

      gap: 16,
    },

    memberCard: {
      background: C.surface2,

      border: `1px solid ${C.border}`,

      borderRadius: 24,

      padding: 18,

      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.02)
      `,
    },

    avatar: {
      width: 44,
      height: 44,

      borderRadius: '50%',

      background: 'rgba(59,130,246,0.14)',

      color: '#93C5FD',

      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',

      fontWeight: 700,

      fontSize: 13,

      marginBottom: 14,
    },
  };

  return (
    <div style={s.wrap}>

      {/* BACKGROUND GLOW */}
      <div
        style={{
          position: 'fixed',
          inset: 0,

          background:
            'radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 30%), radial-gradient(circle at top right, rgba(139,92,246,0.10), transparent 30%)',

          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* TOP */}
      <div style={s.topbar}>

        {/* METRICS */}
        <div style={s.metricGrid}>
          {metrics.map((m) => (
            <div key={m.label} style={s.metricCard(m.color)}>
              <div style={s.metricGlow(m.color)} />

              <div style={s.metricLabel}>
                {m.label}
              </div>

              <div style={s.metricValue}>
                {m.value}
              </div>

              <div style={s.metricSub}>
                {m.sub}
              </div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div style={s.filterArea}>
          <div style={s.filterRow}>
            {filters.map((f, i) => (
              <span key={f} style={s.chip(i === 0)}>
                {f}
              </span>
            ))}
          </div>

          <div style={s.filterRow}>
            {srcFilters.map((f, i) => (
              <span key={f} style={s.chip(i === 0)}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={s.grid}>

        {/* KNOWLEDGE GAPS */}
        <div style={s.card}>
          <div style={s.cardGlow} />

          <div style={s.cardTitle}>
            Knowledge Gaps
          </div>

          {gaps.map((g, i) => (
            <div
              key={g.name}
              style={{
                ...s.itemRow,
                borderBottom:
                  i === gaps.length - 1
                    ? 'none'
                    : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div>
                <div style={{ fontSize: 13 }}>
                  {g.name}
                </div>

                <div style={s.sub}>
                  {g.sub}
                </div>
              </div>

              <span style={s.badge(g.severity)}>
                {g.severity}
              </span>
            </div>
          ))}
        </div>

        {/* ACTIONS */}
        <div style={s.card}>
          <div style={s.cardGlow} />

          <div style={s.cardTitle}>
            Action List
          </div>

          {actions.map((a, i) => (
            <div
              key={i}
              style={{
                ...s.itemRow,
                borderBottom:
                  i === actions.length - 1
                    ? 'none'
                    : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,

                    borderRadius: '50%',

                    marginTop: 5,

                    background:
                      a.high
                        ? C.red
                        : C.amber,
                  }}
                />

                <div style={{ fontSize: 13 }}>
                  {a.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* TOPICS + USAGE */}
        <div style={s.card}>
          <div style={s.cardGlow} />

          <div style={s.cardTitle}>
            Topics & Usage
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',

              gap: 8,

              marginBottom: 22,
            }}
          >
            {topics.map((t, i) => (
              <span
                key={t}
                style={{
                  ...s.chip(i === 0),
                  fontSize: 12,
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {usage.map((u) => (
            <div
              key={u.label}
              style={{
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',

                  fontSize: 12,

                  marginBottom: 6,
                }}
              >
                <span>{u.label}</span>

                <span style={{ color: C.sub }}>
                  {u.count}
                </span>
              </div>

              <div style={s.progressTrack}>
                <div
                  style={{
                    width: `${u.pct}%`,
                    height: '100%',

                    background:
                      'linear-gradient(90deg, #3B82F6, #60A5FA)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* FRESHNESS */}
        <div style={s.card}>
          <div style={s.cardGlow} />

          <div style={s.cardTitle}>
            Freshness
          </div>

          {stale.map((r, i) => (
            <div
              key={r.name}
              style={{
                ...s.itemRow,
                borderBottom:
                  i === stale.length - 1
                    ? 'none'
                    : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span style={{ fontSize: 13 }}>
                {r.name}
              </span>

              <span
                style={{
                  fontSize: 11,
                  color: '#FCA5A5',
                }}
              >
                {r.age}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 11,
                color: C.sub,

                marginBottom: 10,
              }}
            >
              Last Updated Distribution
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',

                gap: 6,

                height: 80,
              }}
            >
              {[35, 60, 90, 55].map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,

                    height: `${h}%`,

                    borderRadius: '6px 6px 0 0',

                    background:
                      i === 0
                        ? '#22C55E'
                        : i === 1
                        ? '#3B82F6'
                        : i === 2
                        ? '#F59E0B'
                        : '#EF4444',

                    opacity: 0.9,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: 'flex',

                gap: 6,

                marginTop: 6,

                fontSize: 10,
                color: C.sub,
              }}
            >
              {['<1M', '1-3M', '3-6M', '>6M'].map((l) => (
                <span key={l} style={{ flex: 1 }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ONBOARDING */}
      <div
        style={{
          ...s.card,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={s.cardGlow} />

        <div style={s.cardTitle}>
          Onboarding Progress
        </div>

        <div style={s.onboardingGrid}>
          {members.map((m) => (
            <div key={m.name} style={s.memberCard}>

              <div style={s.avatar}>
                {m.initials}
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {m.name}
              </div>

              <div style={s.sub}>
                {m.role}
              </div>

              <div style={s.progressTrack}>
                <div
                  style={{
                    width: `${m.pct}%`,
                    height: '100%',

                    background: `linear-gradient(90deg, ${m.color}, ${m.color}CC)`,
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 7,

                  textAlign: 'right',

                  fontSize: 11,
                  color: C.sub,
                }}
              >
                {m.pct}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}