import { people } from "../sim/people";
import type { Snapshot } from "../sim/snapshot";
import { dining, num } from "../ui/format";

// The people panel's words, shared by the web (ui/PeoplePanel.tsx) and the Godot viewer
// (src/bridge/colony.ts): births and what holds them back, school, care and meals, the departed,
// and who's moving on next.

const MOVES = {
  child: (n: number) => `${n} ${n === 1 ? "child grows" : "children grow"} up`,
  adult: (n: number) => `${n} ${n === 1 ? "adult retires" : "adults retire"}`,
  elder: (n: number) => `${n} ${n === 1 ? "elder passes" : "elders pass"} away`,
};

const days = (d: number) => (d < 1 ? "today" : `in ${Math.round(d)} ${Math.round(d) === 1 ? "day" : "days"}`);

export interface PeopleReport {
  work: string;
  leaving: string | null;
  births: { ok: boolean; text: string };
  checks: [boolean, string][];
  born: string;
  care: { label: string; text: string }[];
  departed: string;
  grief: string | null;
  upcoming: string[];
}

export function peopleReport(s: Snapshot): PeopleReport {
  const b = s.births;
  const school = s.care.school;
  const elders = s.care.elders;
  const clinic = s.population.care?.care;
  return {
    work: `Adults work (${s.workforce.employed} of ${s.workforce.total} employed). Children and elders don't, but need beds, food, water and air.`,
    leaving: s.leavingFor ? `Morale is low: colonists are leaving for ${s.leavingFor}, a few each day. Raise happiness above 45 to keep them.` : null,
    births: b.blockers.length === 0 ? { ok: true, text: `About one child every ${Math.max(1, Math.round(1 / Math.max(b.perDay, 1e-6)))} days.` } : { ok: false, text: "No births for now." },
    checks: [
      [!b.blockers.includes("No working clinic"), "A working clinic"],
      [!b.blockers.some((x) => x.startsWith("Happiness")), `Happiness ${people.births.minHappiness} or more (now ${Math.round(s.happiness.average)})`],
      [!b.blockers.includes("No free beds"), `A free bed (${s.population.count}/${s.beds})`],
    ],
    born: b.born ? `${b.born} born here so far.` : "Nobody born here yet.",
    care: [
      {
        label: "Children",
        text: school.who === 0 ? "none yet" : school.missing > 0 ? `${num(school.missing)} of ${school.who} without a school place within reach: their families are unhappy` : `all ${school.who} in school`,
      },
      {
        label: "Elders",
        text: elders.who === 0 ? "none yet" : elders.missing > 0 ? `${num(elders.missing)} of ${elders.who} without elder care within reach: health suffers` : `all ${elders.who} cared for`,
      },
      {
        label: "Clinic",
        text: !clinic || clinic.who === 0 ? "—" : clinic.missing > 0.5 ? `${num(clinic.missing)} of ${clinic.who} without a clinic within reach: health suffers` : "everyone has a clinic within reach",
      },
      { label: "Meals", text: dining(s) },
    ],
    departed: s.rest.composting
      ? "Under Return to the soil, the dead become soil for the farms."
      : s.rest.space > 0
        ? `${s.rest.space} places left in the crypt${s.rest.interred ? `, where ${s.rest.interred} rest` : ""}.`
        : s.stages.elder > 0 || s.rest.interred > 0
          ? "No crypt space: those who pass away will have nowhere to rest."
          : "Nobody has passed away here.",
    grief: s.rest.grief >= 0.5 ? "The hole grieves for dead with nowhere to rest: comfort is down." : null,
    upcoming: s.upcoming.map((u) => `${MOVES[u.stage](u.count)} ${days(u.daysLeft)}`),
  };
}
