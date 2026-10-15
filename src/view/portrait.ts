// Notables' headshots (T-054): a flat vector face drawn as an SVG string, picked from a hash of the
// notable's id and name, so the same person always looks the same, in saves and (later) in Godot,
// with nothing new in the sim. About half of them carry a hint of their work (a hard hat, a
// stethoscope, a headset); traits nudge the expression. Palettes and odds are in data/portraits.json.

import raw from "../../data/portraits.json";

export interface PortraitPerson {
  id: number;
  name: string;
  role: string;
  traits: string[];
}

type RoleLook = { backdrop: string; clothes: string[]; props: string[] };
type Mood = "neutral" | "smile" | "grin" | "smirk" | "flat" | "frown";

/** Everything a face is drawn from: chosen once from the person, so tests can compare faces. */
export interface Face {
  skin: string;
  hair: string;
  eyes: string;
  hairStyle: string;
  head: string;
  clothes: string;
  backdrop: string;
  mood: Mood;
  /** Half the gap between the eyes, in the 64-unit box. */
  eyeGap: number;
  glasses: boolean;
  freckles: boolean;
  beard: boolean;
  moustache: boolean;
  blush: boolean;
  prop: string | null;
}

const ROLES = raw.roles as Record<string, RoleLook>;
const MOODS = raw.moods as Record<string, Mood>;

/** FNV-1a, then a small PRNG (mulberry32) seeded from it: stable across runs and platforms. */
function rng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function portraitFace(p: PortraitPerson): Face {
  const r = rng(`${p.id}|${p.name}`);
  const pick = <T>(list: T[]): T => list[Math.floor(r() * list.length)]!;
  const chance = (odds: number) => r() < odds;
  const look: RoleLook = ROLES[p.role] ?? raw.otherRoles;
  const odds = raw.odds;
  // Every pick is drawn, used or not, so adding a trait mood never reshuffles the rest of a face.
  const face: Face = {
    skin: pick(raw.skin),
    hair: pick(raw.hair),
    eyes: pick(raw.eyes),
    hairStyle: pick(raw.hairStyles),
    head: pick(raw.heads),
    clothes: pick(look.clothes),
    backdrop: look.backdrop,
    mood: pick<Mood>(["neutral", "smile"]),
    eyeGap: 4.2 + r() * 1.4,
    glasses: chance(odds.glasses),
    freckles: chance(odds.freckles),
    beard: chance(odds.beard),
    moustache: chance(odds.moustache),
    blush: chance(odds.blush),
    prop: null,
  };
  const prop = look.props.length ? pick(look.props) : null;
  if (chance(odds.prop)) face.prop = prop;
  const mood = p.traits.map((t) => MOODS[t]).find((m) => m);
  if (mood) face.mood = mood;
  return face;
}

/** Mixes a #rrggbb colour toward black (f < 0) or white (f > 0). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = f < 0 ? 0 : 255;
  const k = Math.abs(f);
  const c = [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * (1 - k) + to * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const f1 = (v: number) => +v.toFixed(1);

/** The face as an SVG string on a 64-unit square (the UI rounds it into a circle). */
export function portraitSvg(p: PortraitPerson, size = 64): string {
  const f = portraitFace(p);
  const cx = 32;
  const cy = 28;
  const heads: Record<string, [number, number]> = { round: [12, 12.5], oval: [11, 13.5], long: [10.5, 14], square: [11.5, 13] };
  const [rx, ry] = heads[f.head] ?? [12, 13];
  const top = cy - ry;
  const l = cx - rx;
  const rt = cx + rx;
  const skinDark = shade(f.skin, -0.18);
  const hairDark = shade(f.hair, -0.25);
  const out: string[] = [];
  const add = (s: string) => out.push(s);

  // Backdrop: the role's tint, lighter behind the head.
  add(`<rect width="64" height="64" fill="${f.backdrop}"/>`);
  add(`<circle cx="32" cy="26" r="24" fill="${shade(f.backdrop, 0.14)}"/>`);

  // Hair that falls behind the head.
  const backHair: Record<string, string> = {
    long: `<path d="M${l - 2} ${cy - 2} Q${l - 4} ${cy + 18} ${l - 1} ${cy + 22} L${rt + 1} ${cy + 22} Q${rt + 4} ${cy + 18} ${rt + 2} ${cy - 2} Z" fill="${f.hair}"/>`,
    bob: `<path d="M${l - 2} ${cy - 3} Q${l - 3} ${cy + 10} ${l} ${cy + 11} L${rt} ${cy + 11} Q${rt + 3} ${cy + 10} ${rt + 2} ${cy - 3} Z" fill="${f.hair}"/>`,
    bun: `<circle cx="${cx}" cy="${top - 2}" r="5.5" fill="${f.hair}"/>`,
    ponytail: `<ellipse cx="${rt + 1.5}" cy="${cy + 4}" rx="2.8" ry="9" fill="${f.hair}" transform="rotate(-22 ${rt + 1.5} ${cy + 4})"/><circle cx="${rt - 0.5}" cy="${cy - 4}" r="1.6" fill="#e07a3f"/>`,
  };
  if (backHair[f.hairStyle]) add(backHair[f.hairStyle]!);

  // Shoulders and neck.
  add(`<path d="M5 64 C7 51 17 46 32 46 C47 46 57 51 59 64 Z" fill="${f.clothes}"/>`);
  add(`<rect x="27" y="${cy + 8}" width="10" height="${46 - cy - 6}" rx="2" fill="${skinDark}"/>`);
  add(`<path d="M26 46.5 L32 53 L38 46.5" fill="${f.skin}"/>`);
  if (f.prop !== "labCollar" && f.prop !== "tie") add(`<path d="M24 47.5 L32 54 L40 47.5" fill="none" stroke="${shade(f.clothes, -0.22)}" stroke-width="1.6" stroke-linejoin="round"/>`);

  // Ears, then the head.
  add(`<circle cx="${l}" cy="${cy + 1}" r="2.6" fill="${skinDark}"/><circle cx="${rt}" cy="${cy + 1}" r="2.6" fill="${skinDark}"/>`);
  add(
    f.head === "square"
      ? `<rect x="${l}" y="${top}" width="${rx * 2}" height="${ry * 2}" rx="6.5" fill="${f.skin}"/>`
      : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f.skin}"/>`,
  );

  // Hair on top.
  const cap = (lift: number, fringe: number, part = 0) =>
    `<path d="M${l - 0.6} ${cy - 1} Q${l - 1} ${top - lift} ${cx} ${top - lift} Q${rt + 1} ${top - lift} ${rt + 0.6} ${cy - 1} L${rt - 1.5} ${cy - 4} Q${cx + part} ${top + fringe} ${l + 1.5} ${cy - 4} Z" fill="${f.hair}"/>`;
  switch (f.hairStyle) {
    case "short":
    case "long":
    case "bob":
    case "bun":
    case "ponytail":
      add(cap(2.5, 6));
      break;
    case "side":
      add(cap(3, 5, 6));
      add(`<path d="M${cx - 3} ${top - 2} Q${cx - 1} ${top + 3} ${cx - 2} ${top + 7}" fill="none" stroke="${hairDark}" stroke-width="0.9" stroke-linecap="round"/>`);
      break;
    case "crop":
      add(cap(1, 3.5));
      break;
    case "buzz":
      add(cap(0.6, 3).replace("/>", ' opacity="0.6"/>'));
      break;
    case "curly":
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1.02 + (i / 8) * 0.96);
        add(`<circle cx="${f1(cx + Math.cos(a) * (rx + 0.5))}" cy="${f1(cy - 2 + Math.sin(a) * (ry - 0.5))}" r="${i % 2 ? 4 : 4.6}" fill="${f.hair}"/>`);
      }
      break;
    case "bald":
      add(`<path d="M${l - 0.4} ${cy - 1} q0 -4 2 -5.5 M${rt + 0.4} ${cy - 1} q0 -4 -2 -5.5" fill="none" stroke="${f.hair}" stroke-width="2.4" stroke-linecap="round"/>`);
      break;
  }

  // Face.
  const ey = cy + 1;
  const g = f1(f.eyeGap);
  if (f.blush) add(`<ellipse cx="${cx - g - 2.5}" cy="${ey + 4.5}" rx="2.6" ry="1.6" fill="#e0707a" opacity="0.28"/><ellipse cx="${cx + g + 2.5}" cy="${ey + 4.5}" rx="2.6" ry="1.6" fill="#e0707a" opacity="0.28"/>`);
  if (f.freckles) {
    for (const [dx, dy] of [[-1.5, 3], [-3.5, 4], [-2.4, 5.4], [1.5, 3], [3.5, 4], [2.4, 5.4]] as const) {
      add(`<circle cx="${f1(cx + Math.sign(dx) * g + dx)}" cy="${ey + dy}" r="0.45" fill="${shade(f.skin, -0.4)}"/>`);
    }
  }
  add(`<ellipse cx="${cx - g}" cy="${ey}" rx="1.3" ry="1.6" fill="${f.eyes}"/><ellipse cx="${cx + g}" cy="${ey}" rx="1.3" ry="1.6" fill="${f.eyes}"/>`);
  add(`<circle cx="${cx - g + 0.4}" cy="${ey - 0.6}" r="0.4" fill="#fff"/><circle cx="${cx + g + 0.4}" cy="${ey - 0.6}" r="0.4" fill="#fff"/>`);
  // Brows: a frown pulls the inner ends down, a grin lifts them.
  const tilt = f.mood === "frown" ? 1.4 : f.mood === "grin" || f.mood === "smile" ? -0.5 : f.mood === "smirk" ? 0.6 : 0;
  const by = ey - 3.6;
  const brow = shade(f.hair === "#d9d4cc" ? "#7e8088" : f.hair, -0.1);
  add(
    `<path d="M${f1(cx - g - 2.2)} ${f1(by - tilt / 2)} L${f1(cx - g + 1.8)} ${f1(by + tilt)} M${f1(cx + g + 2.2)} ${f1(by - tilt / 2 + (f.mood === "smirk" ? -0.8 : 0))} L${f1(cx + g - 1.8)} ${f1(by + tilt)}" stroke="${brow}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`,
  );
  add(`<path d="M${cx + 0.3} ${ey + 1.5} q1.4 2.6 -0.6 3.4" fill="none" stroke="${shade(f.skin, -0.3)}" stroke-width="0.9" stroke-linecap="round"/>`);

  const my = cy + 8.5;
  const lip = shade(f.skin, -0.45);
  const mouth: Record<Mood, string> = {
    neutral: `<path d="M${cx - 3} ${my} q3 1.2 6 0" fill="none" stroke="${lip}" stroke-width="1.1" stroke-linecap="round"/>`,
    smile: `<path d="M${cx - 3.6} ${my - 0.5} q3.6 3.2 7.2 0" fill="none" stroke="${lip}" stroke-width="1.2" stroke-linecap="round"/>`,
    grin: `<path d="M${cx - 4} ${my - 0.8} q4 5 8 0 z" fill="#5a2a22" stroke="${lip}" stroke-width="0.8" stroke-linejoin="round"/><path d="M${cx - 3.3} ${my - 0.4} h6.6 q-0.5 1.2 -1 1.4 h-4.6 q-0.6 -0.3 -1 -1.4z" fill="#f4efe8"/>`,
    smirk: `<path d="M${cx - 3} ${my + 0.3} q3 1 6 -1.6" fill="none" stroke="${lip}" stroke-width="1.1" stroke-linecap="round"/>`,
    flat: `<path d="M${cx - 2.6} ${my + 0.3} h5.2" fill="none" stroke="${lip}" stroke-width="1.1" stroke-linecap="round"/>`,
    frown: `<path d="M${cx - 3.2} ${my + 1.2} q3.2 -2.4 6.4 0" fill="none" stroke="${lip}" stroke-width="1.2" stroke-linecap="round"/>`,
  };
  if (f.beard) add(`<path d="M${l + 1} ${cy + 2} Q${l + 2} ${cy + ry + 3} ${cx} ${cy + ry + 3} Q${rt - 2} ${cy + ry + 3} ${rt - 1} ${cy + 2} Q${rt - 4} ${my + 4} ${cx} ${my + 3.2} Q${l + 4} ${my + 4} ${l + 1} ${cy + 2} Z" fill="${f.hair}"/>`);
  add(mouth[f.mood]);
  if (f.moustache || f.beard) add(`<path d="M${cx - 4} ${my - 0.6} Q${cx} ${my - 3.6} ${cx + 4} ${my - 0.6} Q${cx} ${my - 1.8} ${cx - 4} ${my - 0.6} Z" fill="${f.hair}"/>`);
  if (f.glasses) {
    add(
      `<g fill="none" stroke="#2a1d18" stroke-width="1"><circle cx="${cx - g}" cy="${ey}" r="3.2"/><circle cx="${cx + g}" cy="${ey}" r="3.2"/><path d="M${f1(cx - g + 3.2)} ${ey} h${f1(2 * g - 6.4)} M${f1(cx - g - 3.2)} ${ey} L${l} ${ey - 1} M${f1(cx + g + 3.2)} ${ey} L${rt} ${ey - 1}"/></g>`,
    );
  }

  if (f.prop) add(propSvg(f.prop, { cx, cy, l, rt, top, my, clothes: f.clothes }));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${out.join("")}</svg>`;
}

interface Anchor {
  cx: number;
  cy: number;
  l: number;
  rt: number;
  top: number;
  my: number;
  clothes: string;
}

/** The hint of a notable's work, drawn over the face and clothes. */
function propSvg(prop: string, a: Anchor): string {
  const { cx, cy, l, rt, top, my } = a;
  switch (prop) {
    // Worker.
    case "hardhat":
      return `<path d="M${l - 1} ${cy - 3} Q${l - 1} ${top - 6} ${cx} ${top - 6} Q${rt + 1} ${top - 6} ${rt + 1} ${cy - 3} Z" fill="#e0b030"/><path d="M${cx - 1.4} ${top - 5.6} h2.8 v${cy - 3 - top + 5.6} h-2.8z" fill="#c99a22"/><rect x="${l - 4}" y="${cy - 4}" width="${rt - l + 8}" height="2.6" rx="1.3" fill="#c99a22"/>`;
    case "earDefenders":
      return `<path d="M${l - 1} ${cy} Q${l - 1} ${top - 4} ${cx} ${top - 4} Q${rt + 1} ${top - 4} ${rt + 1} ${cy}" fill="none" stroke="#3e3b38" stroke-width="2.2"/><rect x="${l - 4}" y="${cy - 3}" width="5" height="8" rx="2.4" fill="#d9862f"/><rect x="${rt - 1}" y="${cy - 3}" width="5" height="8" rx="2.4" fill="#d9862f"/>`;
    // Organizer.
    case "megaphonePin":
      return `<circle cx="42" cy="54" r="4" fill="#e07a3f" stroke="#f4efe8" stroke-width="0.8"/><path d="M40 53 l3 -1.6 v4.2 l-3 -1.6 z M39.3 53 h1 v2 h-1z" fill="#f4efe8"/>`;
    case "armband":
      return `<path d="M47 50.2 Q52 51 56.2 54.6 L54.2 60 Q51 56 46 55.4 Z" fill="#c43b2e"/><path d="M46.6 52.6 Q51.6 53.3 55.3 57" fill="none" stroke="#f4efe8" stroke-width="1"/>`;
    // Scientist.
    case "goggles":
      return `<path d="M${l - 0.5} ${top + 7} Q${cx} ${top + 4} ${rt + 0.5} ${top + 7}" fill="none" stroke="#3e3b38" stroke-width="2"/><circle cx="${cx - 4.5}" cy="${top + 5.5}" r="3.4" fill="#8cc8cf" stroke="#3e3b38" stroke-width="1.2"/><circle cx="${cx + 4.5}" cy="${top + 5.5}" r="3.4" fill="#8cc8cf" stroke="#3e3b38" stroke-width="1.2"/><circle cx="${cx - 5.3}" cy="${top + 4.7}" r="0.9" fill="#fff" opacity="0.8"/><circle cx="${cx + 3.7}" cy="${top + 4.7}" r="0.9" fill="#fff" opacity="0.8"/>`;
    case "labCollar":
      return `<path d="M5 64 C7 51 17 46 26 46 L32 60 L38 46 C47 46 57 51 59 64 Z" fill="#ece8e0"/><path d="M26 46 L32 60 L38 46" fill="none" stroke="#c9c2b6" stroke-width="1"/><rect x="42" y="53" width="7" height="6" rx="0.6" fill="#d9d4cc"/><path d="M44 50.5 v4 M46.5 51 v3.5" stroke="#4f9fc8" stroke-width="1.2" stroke-linecap="round"/>`;
    // Doctor.
    case "stethoscope":
      return `<path d="M24 46 Q22 56 29 58 M40 46 Q42 52 38 56" fill="none" stroke="#5c6670" stroke-width="1.4" stroke-linecap="round"/><path d="M29 58 Q33 59 38 56" fill="none" stroke="#5c6670" stroke-width="1.4"/><circle cx="38" cy="56" r="2.2" fill="#b8c0c8" stroke="#5c6670" stroke-width="0.8"/>`;
    case "headMirror":
      return `<path d="M${l - 0.5} ${top + 7} Q${cx} ${top + 3} ${rt + 0.5} ${top + 7}" fill="none" stroke="#3e3b38" stroke-width="1.6"/><circle cx="${cx}" cy="${top + 4.6}" r="4.2" fill="#dfe6ec" stroke="#8a949e" stroke-width="1"/><circle cx="${cx}" cy="${top + 4.6}" r="1" fill="#2a1d18"/>`;
    // Merchant.
    case "scarf":
      return `<path d="M23 45 Q32 50 41 45 L42 49 Q32 54 22 49 Z" fill="#d9a870"/><path d="M36 49 l2 10 l-4 -1 l-1 -8z" fill="#c4935c"/><path d="M24 47.5 Q32 52 40 47.5" fill="none" stroke="#a87a48" stroke-width="0.8" stroke-dasharray="1.6 1.4"/>`;
    case "ledgerPin":
      return `<rect x="39" y="51" width="7" height="8" rx="0.8" fill="#e0bf4a" stroke="#8a6a1e" stroke-width="0.8"/><path d="M40.6 53.5 h3.8 M40.6 55.4 h3.8 M40.6 57.2 h2.4" stroke="#8a6a1e" stroke-width="0.7"/>`;
    // Administrator.
    case "headset":
      return `<path d="M${l - 1} ${cy} Q${l - 1} ${top - 4} ${cx} ${top - 4} Q${rt + 1} ${top - 4} ${rt + 1} ${cy}" fill="none" stroke="#2e3440" stroke-width="1.6"/><rect x="${l - 3.4}" y="${cy - 2}" width="4.2" height="6.4" rx="2" fill="#2e3440"/><path d="M${l - 1} ${cy + 4} Q${l + 1} ${my + 1} ${cx - 5} ${my}" fill="none" stroke="#2e3440" stroke-width="1.1" stroke-linecap="round"/><circle cx="${cx - 5}" cy="${my}" r="1.2" fill="#e07a3f"/>`;
    case "tie":
      return `<path d="M26 46 L32 55 L38 46 Z" fill="#f0ebe2"/><path d="M30.6 49 h2.8 l-0.5 1.8 l1.6 9 l-2.5 3 l-2.5 -3 l1.6 -9z" fill="#b0453a"/><path d="M24 47 L31 55 L27 57 Z M40 47 L33 55 L37 57 Z" fill="${shade(a.clothes, 0.12)}"/>`;
  }
  return "";
}
