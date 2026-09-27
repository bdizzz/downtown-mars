import { useEffect, useMemo, useRef, useState } from "react";
import { degreesApart, DEPOSIT_KINDS, depositsAt, distanceKm, features, nearestFeature, wrapLon, type DepositKind } from "../sim/mapgeo";
import { network } from "../sim/network";
import type { Snapshot } from "../sim/snapshot";

// The planet from above: MOLA relief (loaded when the map first opens),
// the game's deposits, named features, and where the holes are.

export const DEPOSIT_STYLE: Record<DepositKind, { name: string; color: string; hint: string }> = {
  ice: { name: "Ice", color: "#d6ecff", hint: "Water ice: mine it for water" },
  aquifer: { name: "Aquifer", color: "#3f8fff", hint: "Groundwater: a deep well pump draws it" },
  ore: { name: "Ore", color: "#c7a3a3", hint: "Metal ore: a smelter turns it into metal" },
  silica: { name: "Silica", color: "#f0d46a", hint: "Silica: the start of silicon and electronics" },
};

/** Colour by elevation (metres): deep basins dark, plains rust, heights pale. */
const RAMP: [number, [number, number, number]][] = [
  [-8000, [29, 34, 51]],
  [-4000, [64, 42, 40]],
  [-2000, [107, 58, 36]],
  [0, [154, 82, 48]],
  [2000, [184, 115, 63]],
  [5000, [201, 154, 106]],
  [10000, [220, 195, 160]],
  [21000, [244, 236, 224]],
];

function ramp(e: number): [number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    const [e1, c1] = RAMP[i]!;
    const [e0, c0] = RAMP[i - 1]!;
    if (e <= e1) {
      const t = Math.max(0, (e - e0) / (e1 - e0));
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return RAMP[RAMP.length - 1]![1];
}

type Elevation = { width: number; height: number; unitMeters: number; elevation: number[] };

/** Shaded relief as an image: colour by height, lit from the north-west, with the polar caps. */
function relief(d: Elevation): ImageData {
  const { width: w, height: h } = d;
  const img = new ImageData(w, h);
  const at = (x: number, y: number) => d.elevation[Math.min(h - 1, Math.max(0, y)) * w + (((x % w) + w) % w)]! * d.unitMeters;
  for (let y = 0; y < h; y++) {
    const lat = 90 - y - 0.5;
    for (let x = 0; x < w; x++) {
      const e = at(x, y);
      const shade = Math.min(1.35, Math.max(0.55, 1 + (at(x - 1, y - 1) - at(x + 1, y + 1)) / 3500));
      let [r, g, b] = ramp(e);
      // Residual polar ice caps.
      const cap = Math.max(0, (Math.abs(lat) - (lat > 0 ? 80 : 83)) / 5);
      if (cap > 0) [r, g, b] = [r + (236 - r) * Math.min(1, cap), g + (238 - g) * Math.min(1, cap), b + (240 - b) * Math.min(1, cap)];
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, r * shade);
      img.data[i + 1] = Math.min(255, g * shade);
      img.data[i + 2] = Math.min(255, b * shade);
      img.data[i + 3] = 255;
    }
  }
  return img;
}

export type SitePick = { lat: number; lon: number };

interface Props {
  s: Snapshot;
  onClose: () => void;
  /** The site the player has picked, if any, for founding a hole there. */
  site: SitePick | null;
  onSite: (site: SitePick | null) => void;
  /** Send a convoy from the hole you're looking at to found a hole at this site. */
  onFound: (site: SitePick) => void;
}

const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;

export function MapScreen({ s, onClose, site, onSite, onFound }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [elevation, setElevation] = useState<Elevation | null>(null);
  const [size, setSize] = useState({ w: 720, h: 360 });
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const [shown, setShown] = useState<Record<DepositKind, boolean>>({ ice: true, aquifer: true, ore: true, silica: true });

  // Load the elevation data once, and turn it into a small relief image.
  useEffect(() => {
    let alive = true;
    import("../../data/mars-elevation.json").then((mod) => {
      if (!alive) return;
      const d = (mod.default ?? mod) as Elevation;
      const c = document.createElement("canvas");
      c.width = d.width;
      c.height = d.height;
      c.getContext("2d")!.putImageData(relief(d), 0, 0);
      setImage(c);
      setElevation(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Fit a 2:1 map to the space available.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.min(el.clientWidth, el.clientHeight * 2);
      setSize({ w: Math.floor(w), h: Math.floor(w / 2) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toXY = (lat: number, lon: number) => [(((lon % 360) + 360) % 360 / 360) * size.w, ((90 - lat) / 180) * size.h] as const;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !image) return;
    const dpr = window.devicePixelRatio;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(image, 0, 0, size.w, size.h);
    const pxPerDeg = size.w / 360;
    for (const d of s.deposits) {
      if (!shown[d.kind]) continue;
      const [x, y] = toXY(d.lat, d.lon);
      g.beginPath();
      g.ellipse(x, y, d.radiusDeg * pxPerDeg / Math.max(0.2, Math.cos((d.lat * Math.PI) / 180)), d.radiusDeg * pxPerDeg, 0, 0, Math.PI * 2);
      g.fillStyle = DEPOSIT_STYLE[d.kind].color + "55";
      g.strokeStyle = DEPOSIT_STYLE[d.kind].color;
      g.lineWidth = 1.5;
      g.fill();
      g.stroke();
    }
    // Labels shrink with the map, and the small-feature names drop out when it's narrow.
    const labelPx = Math.max(8, Math.min(12, size.w / 70));
    g.font = `600 ${labelPx}px system-ui, sans-serif`;
    g.textAlign = "center";
    for (const f of features) {
      if (size.w < 700 && (f.kind === "crater" || f.kind === "canyon")) continue;
      const [x, y] = toXY(f.lat, f.lon);
      g.fillStyle = "rgba(20,10,8,0.55)";
      g.fillText(f.name, x + 1, y + 1);
      g.fillStyle = "#f6efe6";
      g.fillText(f.name, x, y);
    }
    if (site) {
      const [x, y] = toXY(site.lat, site.lon);
      g.strokeStyle = "#e07a3f";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.moveTo(x - 14, y);
      g.lineTo(x - 4, y);
      g.moveTo(x + 4, y);
      g.lineTo(x + 14, y);
      g.moveTo(x, y - 14);
      g.lineTo(x, y - 4);
      g.moveTo(x, y + 4);
      g.lineTo(x, y + 14);
      g.stroke();
    }
    // Convoys: a dashed line from home to the new site, with the convoy along it.
    for (const c of s.convoys) {
      if (!c.from) continue;
      const [x0, y0] = toXY(c.from.lat, c.from.lon);
      const [x1, y1] = toXY(c.to.lat, c.to.lon);
      g.setLineDash([5, 4]);
      g.strokeStyle = "#e07a3f";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.setLineDash([]);
      const t = Math.min(1, Math.max(0, c.progress));
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 4, 0, Math.PI * 2);
      g.fillStyle = "#e07a3f";
      g.fill();
      g.fillStyle = "#fff";
      g.font = "600 11px system-ui, sans-serif";
      g.fillText(`${c.name} · ${c.daysLeft.toFixed(1)} d`, x1, y1 - 10);
    }
    // Trade routes: a faint line between the holes, each rover a dot on it.
    const siteOf = (id: number) => s.holes.find((h) => h.id === id)?.site ?? null;
    for (const r of s.routes) {
      const a = siteOf(r.fromHoleId);
      const b = siteOf(r.toHoleId);
      if (!a || !b) continue;
      const [x0, y0] = toXY(a.lat, a.lon);
      const [x1, y1] = toXY(b.lat, b.lon);
      g.strokeStyle = "rgba(111, 179, 201, 0.6)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      if (r.idle || r.phase === "loading") continue;
      const t = r.phase === "outbound" ? r.progress : 1 - r.progress;
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3, 0, Math.PI * 2);
      g.fillStyle = r.phase === "outbound" ? "#6fb3c9" : "#9aa7ab";
      g.fill();
    }
    for (const h of s.holes) {
      if (!h.site) continue;
      const [x, y] = toXY(h.site.lat, h.site.lon);
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fillStyle = h.id === s.holeId ? "#e07a3f" : "#f6efe6";
      g.strokeStyle = "#1a0f0d";
      g.lineWidth = 2;
      g.fill();
      g.stroke();
      g.fillStyle = "#fff";
      g.font = "700 12px system-ui, sans-serif";
      g.fillText(h.name, x, y - 10);
    }
  }, [image, size, s.deposits, s.holes, s.holeId, s.convoys, s.routes, shown, site]);

  const info = useMemo(() => {
    if (!hover) return null;
    const near = nearestFeature(hover);
    return {
      where: `${Math.abs(hover.lat).toFixed(1)}°${hover.lat >= 0 ? "N" : "S"} ${hover.lon.toFixed(1)}°E`,
      elevation: elevation
        ? elevation.elevation[Math.min(elevation.height - 1, Math.floor(90 - hover.lat)) * elevation.width + (Math.floor(wrapLon(hover.lon)) % elevation.width)]! *
          elevation.unitMeters
        : 0,
      near: near.km < 600 ? near.feature.name : `${Math.round(near.km)} km from ${near.feature.name}`,
      deposits: depositsAt({ deposits: s.deposits }, hover),
    };
  }, [hover, s.deposits, elevation]);

  return (
    <div className="map-screen" role="dialog" aria-label="Map of Mars">
      <header>
        <h2>Mars</h2>
        <span className="legend">
          {DEPOSIT_KINDS.map((k) => (
            <label key={k} title={DEPOSIT_STYLE[k].hint}>
              <input type="checkbox" checked={shown[k]} onChange={(e) => setShown({ ...shown, [k]: e.target.checked })} />
              <i style={{ background: DEPOSIT_STYLE[k].color }} /> {DEPOSIT_STYLE[k].name}
            </label>
          ))}
        </span>
        <button onClick={onClose} aria-label="Close map">
          ×
        </button>
      </header>
      {!s.mapUnlocked && (
        <p className="map-locked">
          Only the ground near your holes is known yet. The map opens at {network.mapUnlockPopulation} colonists (you have{" "}
          {s.holes.reduce((n, h) => n + h.population, 0)}).
        </p>
      )}
      <div className="map-body">
      <div className="map-wrap" ref={wrapRef}>
        {!image && <p className="k">Loading the planet…</p>}
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover({ lat: 90 - ((e.clientY - r.top) / r.height) * 180, lon: ((e.clientX - r.left) / r.width) * 360 });
          }}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onSite({ lat: 90 - ((e.clientY - r.top) / r.height) * 180, lon: ((e.clientX - r.left) / r.width) * 360 });
          }}
        />
      </div>
      {site && <SitePanel s={s} site={site} elevation={elevation} onClear={() => onSite(null)} onFound={() => onFound(site)} />}
      </div>
      <footer className="k">
        {info
          ? `${info.where} · ${Math.round(info.elevation).toLocaleString()} m · ${info.near}${info.deposits.length ? ` · ${info.deposits.map((k) => DEPOSIT_STYLE[k].name.toLowerCase()).join(", ")}` : ""}`
          : "Elevation: NASA Mars Global Surveyor MOLA. Deposits differ every game."}
      </footer>
    </div>
  );
}

function SitePanel({
  s,
  site,
  elevation,
  onClear,
  onFound,
}: {
  s: Snapshot;
  site: SitePick;
  elevation: Elevation | null;
  onClear: () => void;
  onFound: () => void;
}) {
  const kit = network.seedKit;
  const pop = s.holes.find((h) => h.id === s.holeId)?.population ?? 0;
  const taken = [...s.holes.flatMap((h) => (h.site ? [h.site] : [])), ...s.convoys.map((c) => c.to)];
  const checks: [boolean, string][] = [
    [s.mapUnlocked, `The map is open (at ${network.mapUnlockPopulation} colonists)`],
    [s.kit.hasBay, `${s.holeName} has a staging bay`],
    [
      s.kit.progress >= 0.999,
      `Seed kit gathered (${Math.floor(s.kit.progress * 100)}%${s.kit.progress < 0.999 && !s.kit.gathering ? ": ask the staging bay to gather" : ""})`,
    ],
    [pop - kit.volunteers >= kit.minStayBehind, `${kit.volunteers} volunteers, keeping ${kit.minStayBehind} (${pop} now)`],
    [!taken.some((t) => degreesApart(t, site) < kit.minSpacingDeg), "Far enough from other holes"],
  ];
  const ready = checks.every(([ok]) => ok);
  const near = nearestFeature(site);
  const known = s.mapUnlocked || s.holes.some((h) => h.site && degreesApart(h.site, site) <= network.scoutRadiusDeg);
  const here = depositsAt({ deposits: s.deposits }, site);
  const e = elevation
    ? elevation.elevation[Math.min(elevation.height - 1, Math.floor(90 - site.lat)) * elevation.width + (Math.floor(wrapLon(site.lon)) % elevation.width)]! *
      elevation.unitMeters
    : null;
  return (
    <aside className="site-panel">
      <header>
        <h3>Site</h3>
        <button onClick={onClear} aria-label="Clear site">
          ×
        </button>
      </header>
      <p>
        {fmtLat(site.lat)} {wrapLon(site.lon).toFixed(1)}°E{e !== null && ` · ${Math.round(e).toLocaleString()} m`}
      </p>
      <p className="k">{near.km < 600 ? `At ${near.feature.name}` : `${Math.round(near.km).toLocaleString()} km from ${near.feature.name}`}</p>
      <h4>In the ground</h4>
      {!known ? (
        <p className="k">Not scouted yet.</p>
      ) : here.length ? (
        <ul>
          {here.map((k) => (
            <li key={k}>
              <i style={{ background: DEPOSIT_STYLE[k].color }} /> {DEPOSIT_STYLE[k].name}: {DEPOSIT_STYLE[k].hint.split(": ")[1]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="k">Nothing special: rock only.</p>
      )}
      <h4>From your holes</h4>
      <ul>
        {s.holes
          .filter((h) => h.site)
          .map((h) => {
            const km = distanceKm(h.site!, site);
            return (
              <li key={h.id}>
                {h.name}: {Math.round(km).toLocaleString()} km · {(km / network.roverKmPerDay).toFixed(1)} days by rover
              </li>
            );
          })}
      </ul>
      <h4>Found a hole here</h4>
      <ul className="checks">
        {checks.map(([ok, text]) => (
          <li key={text} className={ok ? "ok" : "no"}>
            {ok ? "✓" : "·"} {text}
          </li>
        ))}
      </ul>
      <button className="found-btn" disabled={!ready} onClick={onFound}>
        Send a convoy from {s.holeName}
      </button>
    </aside>
  );
}
