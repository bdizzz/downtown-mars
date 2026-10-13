import mapData from "../../data/mars-map.json";

// The sun and stars over a site, by its latitude, at the equinox (T-020): no seasons. North is −z in
// the scene, so east is +x and up is +y. The sun rises due east at a quarter past the day, peaks at
// noon 90° − |latitude| up toward the equator, and sets due west; the stars turn with it, once a sol,
// round the celestial pole, which stands at the latitude's height above the north horizon (below it,
// south of the equator, where the south pole is up instead). Used by the web's sky and light
// (render3d/stage3d.ts) and sent to Godot as the site's latitude (bridge/terrain.ts), whose Live.cs
// does the same sums.

export type Vec3 = [number, number, number];

/** A site's latitude, or the default for a hole not on the map yet. */
export const siteLatitude = (site: { lat: number } | null | undefined): number => site?.lat ?? mapData.sky.defaultLatitude;

/** The hour angle: 0 at noon, growing through the afternoon, in radians. */
const hourAngle = (dayFraction: number) => (dayFraction - 0.5) * 2 * Math.PI;

/** Where the sun is, a unit direction from the ground, at this time of day (0..1, 0 midnight) and latitude (degrees). */
export function sunDirection(dayFraction: number, latDeg: number): Vec3 {
  const h = hourAngle(dayFraction);
  const lat = (latDeg * Math.PI) / 180;
  return [-Math.sin(h), Math.cos(lat) * Math.cos(h), Math.sin(lat) * Math.cos(h)];
}

/** The north celestial pole, a unit direction: |latitude| above the north horizon (or below it, in the south). */
export function celestialPole(latDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  return [0, Math.sin(lat), -Math.cos(lat)];
}

/**
 * The stars' turn: a rotation (row-major 3 × 3) that takes a direction in the sky now back to where it
 * was at noon, so the sky shader looks its stars up in a field that turns with the sun about the pole.
 */
export function starTurn(dayFraction: number, latDeg: number): number[] {
  const [x, y, z] = celestialPole(latDeg);
  const a = hourAngle(dayFraction);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

/** A row-major 3 × 3 rotation applied to a direction. */
export const turn = (m: number[], v: Vec3): Vec3 => [
  m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2],
  m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2],
  m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2],
];
