import type { FileRisk, RiskMap } from "../../services/offboardingTypes";
import { formatDay, percent } from "./format";

/** One metric of the team's selection, explained, with what it measured on one file. */
export interface MetricStep {
  /** Its number in the team's selection; none for the score that combines them. */
  number: number | null;
  name: string;
  /** Where it comes from in the full list of metrics, such as `E4`. */
  id: string;
  /** What it measures. */
  asks: string;
  /** How it is calculated, in words. */
  how: string;
  /** Why the prototype uses it. */
  why: string;
  /** What it came to on this file, with the numbers put in. */
  measured: string;
  /** The result as a share from 0 to 1, when it is one; drawn as a bar. */
  value: number | null;
  source: string;
}

const KNOWLEDGE_RISK_LEVEL = 0.5;
const KNOWLEDGE_RISK_ABANDONED = 0.3;
const KNOWLEDGE_RISK_CONCENTRATION = 0.2;
const HOARDED_LEVEL = 0.75;
const RELEVANCE_FLOOR = 0.25;
const RELEVANCE_WEIGHT = 0.75;
const ISLAND_SHARE = 0.95;

function people(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "nobody";
}

function leaverStep(map: RiskMap): MetricStep {
  return {
    number: 1,
    name: "Leaver status",
    id: "E4",
    asks: "Who is gone, and who is as good as gone?",
    how: `Each person is active, inactive or gone. Gone is marked by hand; inactive is a heuristic: no change or review for ${map.settings.inactiveAfterDays} days before the date.`,
    why: "Without knowing who left there are no files at risk, no abandoned lines and no simulation. The heuristic catches quiet departures nobody enters.",
    measured: `Marked as leaving in this run: ${people(map.departing)}. Anybody silent for ${map.settings.inactiveAfterDays} days is already counted as gone.`,
    value: null,
    source: "Hajari et al. 2024, Nassif & Robillard 2017",
  };
}

function knowledgeStep(file: FileRisk, map: RiskMap): MetricStep {
  const knowledge = map.settings.knowledge;
  const model = knowledge?.model ?? "authorship";
  const rule =
    model === "time-weighted"
      ? `Somebody knows the file once K reaches ${knowledge?.knowsAtLeast ?? 1}, about one fresh commit.`
      : `This run uses authorship instead: somebody is an author at ${percent(map.settings.authorThreshold)} of the file's highest degree of authorship. Switch to time-weighted to use K.`;
  return {
    number: 2,
    name: "Time-weighted knowledge",
    id: "A3 + A6 + E1",
    asks: "How well does each person know the file, so that we can say who knows it?",
    how: `K = 3 × first commit + every commit + 0.5 × every review, each weighted by e^(−age/220 days), a half-life of about ${map.settings.halfLifeDays} days. ${rule}`,
    why: "One model underneath most other values, so they cannot contradict each other. Reviews count: in small teams they spread knowledge more than commits do. And knowledge goes stale.",
    measured: `After the departure ${people(file.remainingKnowers)} still know${file.remainingKnowers.length === 1 ? "s" : ""} it.`,
    value: null,
    source: "Jabrayilzade et al. 2022, Thongtanunam et al. 2016",
  };
}

function levelStep(file: FileRisk): MetricStep {
  const orphaned = file.level === "ORPHANED";
  return {
    number: 3,
    name: "File-at-risk level",
    id: "C3",
    asks: "How many active people know the file?",
    how: "Count the active knowers: 0 is orphaned, 1 is hoarded, 2 or more is shared. Files at risk have at most one.",
    why: "The most direct answer to which file is at risk, with a threshold everybody understands. An absolute count works the same in a project of 3 or 300 people; it replaces the truck factor.",
    measured: orphaned
      ? "0 active knowers: orphaned."
      : `1 active knower, ${people(file.remainingKnowers)}: hoarded. The next departure orphans it.`,
    value: orphaned ? 1 : HOARDED_LEVEL,
    source: "Mirsaeedi & Rigby 2020, Hajari et al. 2024",
  };
}

function abandonedStep(file: FileRisk): MetricStep {
  const share = file.abandonedShare;
  return {
    number: 4,
    name: "Share of abandoned lines",
    id: "C1 (A4)",
    asks: "How much of today's code was written by people who are gone?",
    how: "git blame attributes every current line; the share written by leavers. Blame ignores whitespace and follows moved and copied lines.",
    why: "Complements #3: a file can have two active knowers who each reviewed once while 95% of the code comes from somebody gone. And it is a share, so 72% says more than not yet orphaned.",
    measured:
      typeof share === "number"
        ? `${percent(share)} of the lines are theirs.`
        : "Not measured: the file was never blamed.",
    value: typeof share === "number" ? share : null,
    source: "Rigby et al. 2016, Nassif & Robillard 2017",
  };
}

function concentrationStep(file: FileRisk): MetricStep | null {
  const concentration = file.concentration;
  if (!concentration) return null;
  const fractal = 1 - 1 / Math.max(concentration.effectiveKnowers, 1);
  const island = concentration.island
    ? `${concentration.island} holds at least ${percent(ISLAND_SHARE)} of it: a knowledge island.`
    : "Nobody holds 95% of it, so no knowledge island.";
  return {
    number: 5,
    name: "Knowledge concentration",
    id: "B6 + C6",
    asks: "How unevenly is the knowledge of the file spread?",
    how: "Fractal value FV = 1 − Σ share², from 0 for one person towards 1 for many equal shares. Effective knowers = 1 / (1 − FV). One person at 95% or more is a knowledge island.",
    why: "Finer than #3: two knowers of whom one holds 98% are nearly an island. Gini is unstable with two or three contributors; FV stays smooth. Island plus hotspot is the strongest risk class.",
    measured: `FV ${fractal.toFixed(2)}, so ${concentration.effectiveKnowers.toFixed(1)} effective knowers. ${island}`,
    value: Math.min(1, 1 / Math.max(concentration.effectiveKnowers, 1)),
    source: "D'Ambros et al. 2005, CodeScene",
  };
}

function activityStep(file: FileRisk): MetricStep {
  return {
    number: 6,
    name: "Activity",
    id: "D1 + E3",
    asks: "How often, and how recently, is the file changed?",
    how: "The sum over its commits of e^(−age/220 days), so recent changes count most, and the date of the last change.",
    why: "The simplest relevance signal: an orphaned file nobody touches is harmless, one worked on every week is a problem. The same decay as #2 keeps small histories smooth.",
    measured: `${percent(file.recentActivity)} of the most active file; last changed ${formatDay(file.lastChangedAt)}.`,
    value: file.recentActivity,
    source: "Tornhill 2018, code-maat",
  };
}

function hotspotStep(file: FileRisk): MetricStep {
  const hotspot = file.hotspot;
  return {
    number: 7,
    name: "Hotspot",
    id: "D2 (D7)",
    asks: "Is the file complicated and changed often?",
    how: "Activity (#6) times complexity, both as percentile ranks inside the repository. Complexity needs no parser: the sum of the indentation levels of all lines.",
    why: "Tells an active but trivial file from an active and hard-to-follow one, where missing knowledge hurts. Language-neutral, with ranks so projects of any size compare.",
    measured:
      typeof hotspot === "number"
        ? `${percent(hotspot)}: ranks that high among the files of the project.`
        : "Not measured: its complexity was never read.",
    value: typeof hotspot === "number" ? hotspot : null,
    source: "Tornhill 2018, 2024",
  };
}

function couplingStep(file: FileRisk): MetricStep {
  const partners = file.coupling?.partners ?? [];
  const top = partners[0];
  return {
    number: 8,
    name: "Change coupling",
    id: "D5",
    asks: "Which files change in the same commits?",
    how: "degree(a, b) = shared commits / average number of commits of a and b. Pairs with at least 3 shared commits and a degree of 0.3 count; the sum over all partners is the sum of couplings.",
    why: "Risk spreads: a hoarded file coupled with five others makes them dependent too. It stands in for the dependency graph without a parser, and finds links no import shows.",
    measured: top
      ? `${partners.length} partner file${partners.length === 1 ? "" : "s"}, the strongest ${top.path.split("/").at(-1)} at ${percent(top.degree)}; sum ${(file.coupling?.sum ?? 0).toFixed(1)}.`
      : "No partner file: it changes alone.",
    value: top ? top.degree : null,
    source: "Gall et al. 1998, D'Ambros et al. 2009",
  };
}

function simulationStep(file: FileRisk, map: RiskMap): MetricStep {
  const { knowledgeWeight: k, activityWeight: a } = map.settings;
  const computed = k * file.departingShare + a * file.recentActivity;
  return {
    number: 9,
    name: "Departure simulation",
    id: "C7",
    asks: "What do we lose if these people go?",
    how: `Mark the people as gone, recompute everything, show the difference. The default ordering also scores the file as ${k} × the leavers' share of the evidence + ${a} × activity.`,
    why: "The core offboarding question, and no new data: it reuses #1 to #8, which makes it a test of whether the metrics fit together. With 2 to 15 people every departure and pair can be calculated.",
    measured: `Leaving: ${people(map.departing)}. ${k} × ${percent(file.departingShare)} + ${a} × ${percent(file.recentActivity)} = ${percent(computed)}.`,
    value: file.score,
    source: "Rigby et al. 2016, Klimov et al. 2023",
  };
}

function successorStep(file: FileRisk): MetricStep {
  const names = (file.successors ?? []).map((s) => s.person);
  return {
    number: 10,
    name: "Successor suggestion",
    id: "C8",
    asks: "Who could take the file over?",
    how: "Matrix of person × file changes times the coupling matrix (#8): who worked a lot on the files that change with this one. Leavers and people who already know the file are left out.",
    why: "Turns red into an action: these people know its surroundings, plan one for the next review. Cheap, and it fits SprintStart's who-to-ask idea.",
    measured:
      names.length > 0
        ? `Best candidates: ${names.join(", ")}.`
        : "Nobody who stays knows its surroundings.",
    value: file.successors?.[0]?.score ?? null,
    source: "Mockus 2009, Rigby et al. 2016",
  };
}

function placeholderStep(file: FileRisk): MetricStep | null {
  if (typeof file.placeholderScore !== "number") return null;
  const level = file.level === "ORPHANED" ? 1 : HOARDED_LEVEL;
  const abandoned = file.abandonedShare ?? 0;
  const eff = file.concentration?.effectiveKnowers;
  const concentrated = eff && eff > 0 ? 1 / eff : 1;
  const atRisk =
    KNOWLEDGE_RISK_LEVEL * level +
    KNOWLEDGE_RISK_ABANDONED * abandoned +
    KNOWLEDGE_RISK_CONCENTRATION * concentrated;
  const factor = atRisk > 0 ? file.placeholderScore / atRisk : 0;
  const relevance = Math.min(1, Math.max(0, (factor - RELEVANCE_FLOOR) / RELEVANCE_WEIGHT));
  return {
    number: null,
    name: "Placeholder score",
    id: "Score",
    asks: "All of it together: how much knowledge is at risk, scaled by how much the file matters?",
    how: "Knowledge at risk = 0.5 × level (#3) + 0.3 × abandoned lines (#4) + 0.2 × (1 − FV) (#5). Relevance = 0.4 × activity + 0.4 × hotspot + 0.2 × coupling (#6 to #8), as ranks. Score = risk × (0.25 + 0.75 × relevance).",
    why: "Provisional and deliberately simple, so the prototype can show a sorted list. Multiplied, not added, so a dormant file does not top the list on poor knowledge spread alone; the floor of 0.25 keeps it visible. All weights are configuration.",
    measured: `Knowledge at risk ${percent(atRisk)} × (0.25 + 0.75 × relevance ${percent(relevance)}) = ${percent(file.placeholderScore)}`,
    value: file.placeholderScore,
    source: "The team's metric selection",
  };
}

/** Every metric of the team's selection, in order, as it came out for [file]. */
export function describeMetrics(file: FileRisk, map: RiskMap): MetricStep[] {
  return [
    leaverStep(map),
    knowledgeStep(file, map),
    levelStep(file),
    abandonedStep(file),
    concentrationStep(file),
    activityStep(file),
    hotspotStep(file),
    couplingStep(file),
    simulationStep(file, map),
    successorStep(file),
    placeholderStep(file),
  ].filter((step): step is MetricStep => step !== null);
}
