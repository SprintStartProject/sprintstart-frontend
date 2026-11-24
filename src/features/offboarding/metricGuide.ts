import type { FileRisk, RiskMap } from "../../services/offboardingTypes";
import { percent } from "./format";

/** One metric, explained, with what it measured on one file. */
export interface MetricStep {
  /** Where it comes from in the literature, by the id of the team's metric list. */
  id: string;
  name: string;
  /** The question the metric answers. */
  asks: string;
  /** How it is calculated, in words. */
  how: string;
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

function people(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "nobody";
}

function knowledgeStep(file: FileRisk, map: RiskMap): MetricStep {
  const model = map.settings.knowledge?.model ?? "authorship";
  const rule =
    model === "time-weighted"
      ? `somebody knows a file once their weighted, fading evidence reaches ${map.settings.knowledge?.knowsAtLeast ?? 1} commit`
      : `somebody is an author once their degree of authorship is at least ${percent(map.settings.authorThreshold)} of the file's highest`;
  return {
    id: "A1 / A3",
    name: "Who knows the file",
    asks: "Which people count as knowing this file at all?",
    how: `Degree of authorship: who created the file and how often they changed it, less the changes of others. With the ${model} model, ${rule}.`,
    measured: `Still knowing it after the departure: ${people(file.remainingKnowers)}. Leaving: ${people(map.departing)}.`,
    value: null,
    source: "Fritz et al. 2010, Jabrayilzade et al. 2022",
  };
}

function levelStep(file: FileRisk): MetricStep {
  const orphaned = file.level === "ORPHANED";
  return {
    id: "C3",
    name: "File at risk",
    asks: "Does the file keep enough people who know it?",
    how: "A file is at risk when at most one active person still knows it. Nobody left means orphaned; one left means the next departure orphans it.",
    measured: orphaned
      ? "Nobody who stays knows this file: it is orphaned."
      : `Only ${people(file.remainingKnowers)} still knows this file: it hangs on one person.`,
    value: orphaned ? 1 : HOARDED_LEVEL,
    source: "Mirsaeedi & Rigby 2020, Hajari et al. 2024",
  };
}

function departureStep(file: FileRisk, map: RiskMap): MetricStep {
  const { knowledgeWeight: k, activityWeight: a } = map.settings;
  const computed = k * file.departingShare + a * file.recentActivity;
  return {
    id: "C7",
    name: "Departure score",
    asks: "How much of what is known about the file walks out of the door, and how alive is it?",
    how: `Share of the evidence held by the leaving people, weighted ${k}, plus how recently and how often the file changes, weighted ${a}. Changes fade with a half-life of ${map.settings.halfLifeDays} days.`,
    measured: `${k} × ${percent(file.departingShare)} + ${a} × ${percent(file.recentActivity)} = ${percent(computed)}`,
    value: file.score,
    source: "Rigby et al. 2016, Klimov et al. 2023",
  };
}

function inactiveStep(file: FileRisk, map: RiskMap): MetricStep {
  return {
    id: "E4 / E5",
    name: "Inactive people",
    asks: "Is somebody who stays already gone in practice?",
    how: `A person with no change for ${map.settings.inactiveAfterDays} days before the date counts as gone, and is left out of the people who know the file.`,
    measured: `${people(file.remainingKnowers)} stays and is still active; people who went quiet were already removed before this count.`,
    value: null,
    source: "Hajari et al. 2024, Nassif & Robillard 2017",
  };
}

function fragmentationStep(file: FileRisk): MetricStep {
  const verdict =
    file.fragmentation < 0.1
      ? "one person wrote almost everything"
      : file.fragmentation < 0.5
        ? "a few people share it, one clearly leading"
        : "many people share it about equally";
  return {
    id: "B6",
    name: "Fragmentation",
    asks: "How scattered is the work on the file?",
    how: "One minus the sum of the squared commit shares of every person: 0 for a single author, towards 1 for many equal shares.",
    measured: `${percent(file.fragmentation)}: ${verdict}.`,
    value: file.fragmentation,
    source: "D'Ambros et al. 2005",
  };
}

function concentrationStep(file: FileRisk): MetricStep | null {
  const concentration = file.concentration;
  if (!concentration) return null;
  const island = concentration.island
    ? `${concentration.island} holds almost all of it, a knowledge island.`
    : "Nobody holds almost all of it.";
  return {
    id: "C6",
    name: "Knowledge concentration",
    asks: "How many equally strong knowers is the knowledge worth, and does one person hold nearly all of it?",
    how: "One over the sum of the squared knowledge shares gives the effective number of knowers. One person at or above 95% of the knowledge makes a knowledge island.",
    measured: `${concentration.effectiveKnowers.toFixed(1)} effective knowers. ${island}`,
    value: Math.min(1, 1 / Math.max(concentration.effectiveKnowers, 1)),
    source: "CodeScene knowledge islands, Rigby et al. 2016",
  };
}

function abandonedStep(file: FileRisk): MetricStep {
  const share = file.abandonedShare;
  return {
    id: "A4 / C1",
    name: "Lines of people who left",
    asks: "How much of the code as it stands today was written by people who are leaving?",
    how: "git blame counts the current lines of the file per author; the share of lines written by people who leave or were already inactive.",
    measured:
      typeof share === "number"
        ? `${percent(share)} of the lines are theirs.`
        : "Not measured: the file was never blamed.",
    value: typeof share === "number" ? share : null,
    source: "Rigby et al. 2016",
  };
}

function hotspotStep(file: FileRisk): MetricStep {
  const hotspot = file.hotspot;
  return {
    id: "D2",
    name: "Hotspot",
    asks: "Is the file complicated and changed often, so that missing knowledge hurts more?",
    how: "Complexity (the indentation of the file, read when it is ingested) ranked against the other files, together with how often it changes.",
    measured:
      typeof hotspot === "number"
        ? `${percent(hotspot)} of the way to the worst hotspot of the project.`
        : "Not measured: its complexity was never read.",
    value: typeof hotspot === "number" ? hotspot : null,
    source: "Tornhill 2018",
  };
}

function couplingStep(file: FileRisk): MetricStep {
  const partners = file.coupling?.partners ?? [];
  const top = partners[0];
  return {
    id: "D5",
    name: "Change coupling",
    asks: "Which other files change in the same commits as this one?",
    how: "For every pair of files: how often they appear in the same commit, relative to how often either changes. The sum over all partners shows how entangled the file is.",
    measured: top
      ? `${partners.length} partner file(s), strongest ${top.path.split("/").at(-1)} (${percent(top.degree)}); sum ${(file.coupling?.sum ?? 0).toFixed(1)}.`
      : "Changes alone: no partner file.",
    value: top ? top.degree : null,
    source: "Gall et al. 1998, D'Ambros et al. 2009",
  };
}

function successorStep(file: FileRisk): MetricStep {
  const names = (file.successors ?? []).map((s) => s.person);
  return {
    id: "C8",
    name: "Successors",
    asks: "Who could take the file over?",
    how: "People who stay and know the files around it: those that change together with it and its neighbours in the same folder, weighted by their own authorship and reviews.",
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
    id: "Selection",
    name: "Placeholder score",
    asks: "All of it together: how much knowledge is at risk, scaled by how much the file matters?",
    how: "0.5 × level + 0.3 × lines of people who left + 0.2 × one over the effective knowers, times 0.25 plus 0.75 × the file's relevance (activity, hotspot, coupling). The weights are provisional.",
    measured: `Knowledge at risk ${percent(atRisk)} × (0.25 + 0.75 × relevance ${percent(relevance)}) = ${percent(file.placeholderScore)}`,
    value: file.placeholderScore,
    source: "The team's metric selection",
  };
}

/** Every metric of the ranking, in the order they are explained, as it came out for [file]. */
export function describeMetrics(file: FileRisk, map: RiskMap): MetricStep[] {
  return [
    knowledgeStep(file, map),
    levelStep(file),
    departureStep(file, map),
    inactiveStep(file, map),
    fragmentationStep(file),
    concentrationStep(file),
    abandonedStep(file),
    hotspotStep(file),
    couplingStep(file),
    successorStep(file),
    placeholderStep(file),
  ].filter((step): step is MetricStep => step !== null);
}
