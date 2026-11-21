import type { PeopleFilter, PeopleSort, PersonRow, PersonView } from "../sim/personView";

// A person's card and the people list, in words (#528): shared by the web's
// PersonCard and PeoplePanel and the Godot bridge (src/bridge/people.ts), so
// both say the same thing.

const STAGE: Record<PersonView["stage"], string> = { child: "child", adult: "adult", elder: "elder" };
const RELATION: Record<PersonView["family"][number]["relation"], string> = { partner: "partner", parent: "parent", child: "child", sibling: "sibling", family: "family" };

/** An age: years, or months for the very young ("8 months"). */
export const ageText = (p: { age: number; months: number }) => (p.age >= 2 ? String(p.age) : `${p.months} ${p.months === 1 ? "month" : "months"}`);

/** A walk in metres, rounded to 10 m steps. */
export const walkText = (m: number) => (m > 0 ? `${Math.round(m / 10) * 10} m` : "—");

/** A need's factor (−3..+3) as a share of a meter, 0..1 (0 in the middle). */
export const needShare = (v: number) => Math.max(0, Math.min(1, (v + 3) / 6));

export interface CardText {
  name: string;
  /** "34, adult · second generation · organizer" */
  subtitle: string;
  /** Label and text; a room id where the text is a room to show. */
  facts: { label: string; text: string; roomId?: number }[];
  /** Each need: its factor, its share of a meter (0.5 in the middle) and the factor in words ("+0.4"). */
  needs: { label: string; value: number; share: number; text: string }[];
  family: { id: number; text: string }[];
  /** "Commute −2", biggest first. */
  reasons: { text: string; good: boolean }[];
  /** A line under it all, if any ("Mourning someone in the family"). */
  note: string | null;
}

const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth"];

export function personCard(p: PersonView): CardText {
  const gen = ORDINAL[p.gen] ?? `${p.gen}th`;
  const subtitle = [`${ageText(p)}, ${STAGE[p.stage]}`, `${gen} generation`, ...(p.notable ? [p.notable] : [])].join(" · ");
  const facts: CardText["facts"] = [
    { label: "Home", text: p.home?.name ?? "No bed", ...(p.home ? { roomId: p.home.id } : {}) },
    { label: "Work", text: p.job?.name ?? (p.stage === "child" ? "Too young to work" : p.stage === "elder" ? "Retired" : "Out of work"), ...(p.job ? { roomId: p.job.id } : {}) },
    { label: "Walks", text: `to work ${walkText(p.commuteM)} · to a galley ${walkText(p.foodM)}` },
    { label: "Traits", text: p.traits.join(", ") },
    { label: "Happiness", text: String(Math.round(p.happiness)) },
  ];
  const needs = [
    { label: "Comfort", value: p.needs.comfort },
    { label: "Fed", value: p.needs.fed },
    { label: "Health", value: p.needs.health },
  ].map((n) => ({ ...n, share: needShare(n.value), text: `${n.value >= 0 ? "+" : "−"}${Math.abs(n.value).toFixed(1)}` }));
  const family = p.family.map((f) => ({ id: f.id, text: `${f.name}, ${f.relation === "family" ? `family (${STAGE[f.stage]})` : RELATION[f.relation]}` }));
  const reasons = p.reasons.map((r) => ({ text: `${r.label} ${r.points > 0 ? "+" : "−"}${Math.abs(Math.round(r.points))}`, good: r.points > 0 }));
  return { name: p.name, subtitle, facts, needs, family, reasons, note: p.mourning ? "Mourning someone in the family." : null };
}

/** One row of the people list, as a line: "Ana Ruiz · 34 · happiness 62 · Bunk dorm (F1)". */
export function rowText(r: PersonRow): { name: string; detail: string } {
  return { name: r.name, detail: [ageText(r), `happiness ${Math.round(r.happiness)}`, r.home ?? "no bed"].join(" · ") };
}

export const SORTS: { id: PeopleSort; label: string }[] = [
  { id: "happiness", label: "Unhappiest first" },
  { id: "age", label: "Oldest first" },
  { id: "commute", label: "Longest walk to work" },
  { id: "name", label: "Name" },
];

export const FILTERS: { id: PeopleFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "unhappy", label: "Unhappy" },
  { id: "homeless", label: "No bed" },
  { id: "jobless", label: "Out of work" },
  { id: "children", label: "Children" },
  { id: "elders", label: "Elders" },
  { id: "mourning", label: "Mourning" },
];

/** "1–50 of 312". */
export function pageText(total: number, offset: number, shown: number): string {
  if (!total) return "Nobody";
  return `${offset + 1}–${offset + shown} of ${total}`;
}
