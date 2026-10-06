/**
 * How far out Iso may zoom: the distance at which a disc on the floor (every ring's footprint, with a
 * little padding) just fits the view. Pure maths, no Three.js, so the Godot viewer can mirror it.
 */

/**
 * The camera sits `dist` from the disc's centre, `elev` radians above the floor, looking at a point
 * `past` metres beyond the centre (away from the camera). Returns the least `dist` at which every
 * point of the disc's rim (`radius` m) is inside a view `fovDeg` degrees tall with the given aspect.
 */
export function isoFitDistance(radius: number, elev: number, fovDeg: number, aspect: number, past = 0): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  const fits = (d: number): boolean => {
    // In the plane through the camera and the axis: camera at (d cos e, d sin e), looking at (-past, 0).
    const cx = d * Math.cos(elev), cy = d * Math.sin(elev);
    let fx = -past - cx, fy = -cy;
    const fl = Math.hypot(fx, fy);
    fx /= fl;
    fy /= fl;
    // Up is perpendicular to forward in that plane; right is the third axis (z).
    const ux = -fy, uy = fx;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const px = radius * Math.cos(a) - cx, py = -cy, pz = radius * Math.sin(a);
      const ahead = px * fx + py * fy;
      if (ahead <= 0) return false;
      if (Math.abs(pz) > tanH * ahead || Math.abs(px * ux + py * uy) > tanV * ahead) return false;
    }
    return true;
  };
  let lo = radius * 0.1, hi = radius * 100;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
