import { UI_FONT } from "../view/font";
import { useEffect, useMemo, useState } from "react";
import { Globe } from "./Globe";
import { DEPOSIT_KINDS, depositsAt, features, nearestFeature, wrapLon, type DepositKind } from "../sim/mapgeo";
import { network } from "../sim/network";
import { DEPOSIT_STYLE, siteReport, type Elevation } from "../view/network";
import type { Snapshot } from "../sim/snapshot";

// The planet from above: MOLA relief (loaded when the map first opens),
// the game's deposits, named features, and where the holes are.

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


/** The map drawn to wrap the globe: 2:1, with a scale for marks and names drawn on it. */
const TEXTURE = { w: 2048, h: 1024, scale: 1.7 };

export function MapScreen({ s, onClose, site, onSite, onFound }: Props) {
  // Everything is drawn flat into this canvas, which the globe wears.
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEXTURE.w;
    c.height = TEXTURE.h;
    return c;
  }, []);
  const [version, setVersion] = useState(0);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [elevation, setElevation] = useState<Elevation | null>(null);
  const size = { w: TEXTURE.w, h: TEXTURE.h };
  const S = TEXTURE.scale;
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

  const toXY = (lat: number, lon: number) => [(((lon % 360) + 360) % 360 / 360) * size.w, ((90 - lat) / 180) * size.h] as const;

  useEffect(() => {
    if (!image) return;
    const g = canvas.getContext("2d")!;
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
      g.lineWidth = 1.5 * S;
      g.fill();
      g.stroke();
    }
    // Names of the places on the planet.
    g.font = `600 ${Math.round(12 * S)}px ${UI_FONT}`;
    g.textAlign = "center";
    for (const f of features) {
      const [x, y] = toXY(f.lat, f.lon);
      g.fillStyle = "rgba(20,10,8,0.55)";
      g.fillText(f.name, x + 1, y + 1);
      g.fillStyle = "#f6efe6";
      g.fillText(f.name, x, y);
    }
    if (site) {
      const [x, y] = toXY(site.lat, site.lon);
      g.strokeStyle = "#e07a3f";
      g.lineWidth = 2 * S;
      g.beginPath();
      g.arc(x, y, 9 * S, 0, Math.PI * 2);
      g.moveTo(x - 14 * S, y);
      g.lineTo(x - 4 * S, y);
      g.moveTo(x + 4 * S, y);
      g.lineTo(x + 14 * S, y);
      g.moveTo(x, y - 14 * S);
      g.lineTo(x, y - 4 * S);
      g.moveTo(x, y + 4 * S);
      g.lineTo(x, y + 14 * S);
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
      g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 4 * S, 0, Math.PI * 2);
      g.fillStyle = "#e07a3f";
      g.fill();
      g.fillStyle = "#fff";
      g.font = `600 ${Math.round(11 * S)}px ${UI_FONT}`;
      g.fillText(`${c.name} · ${c.daysLeft.toFixed(1)} d`, x1, y1 - 10 * S);
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
    // Colonists moving between holes: a small violet dot on the way.
    for (const m of s.migrations) {
      const a = siteOf(m.from);
      const b = siteOf(m.to);
      if (!a || !b) continue;
      const [x0, y0] = toXY(a.lat, a.lon);
      const [x1, y1] = toXY(b.lat, b.lon);
      const t = Math.min(1, Math.max(0, m.progress));
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3, 0, Math.PI * 2);
      g.fillStyle = "#b48ad8";
      g.fill();
    }
    for (const h of s.holes) {
      if (!h.site) continue;
      const [x, y] = toXY(h.site.lat, h.site.lon);
      g.beginPath();
      g.arc(x, y, 6 * S, 0, Math.PI * 2);
      g.fillStyle = h.id === s.holeId ? "#e07a3f" : "#f6efe6";
      g.strokeStyle = "#1a0f0d";
      g.lineWidth = 2 * S;
      g.fill();
      g.stroke();
      g.fillStyle = "#fff";
      g.font = `700 ${Math.round(13 * S)}px ${UI_FONT}`;
      g.fillText(h.name, x, y - 10 * S);
    }
    setVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, canvas, s.deposits, s.holes, s.holeId, s.convoys, s.routes, s.migrations, shown, site]);

  // Open facing the hole you're looking at (or the site picked).
  const home = s.holes.find((h) => h.id === s.holeId)?.site;
  const [focus] = useState(() => site ?? home ?? { lat: 20, lon: 0 });

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
      <div className="map-wrap">
        {!image ? (
          <p className="k">Loading the planet…</p>
        ) : (
          <Globe map={canvas} version={version} focus={focus} onHover={setHover} onPick={onSite} />
        )}
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
  const report = siteReport(s, site, elevation);
  return (
    <aside className="site-panel">
      <header>
        <h3>Site</h3>
        <button onClick={onClear} aria-label="Clear site">
          ×
        </button>
      </header>
      <p>{report.where}</p>
      <p className="k">{report.near}</p>
      <h4>In the ground</h4>
      {!report.known ? (
        <p className="k">Not scouted yet.</p>
      ) : report.deposits.length ? (
        <ul>
          {report.deposits.map((k) => (
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
        {report.distances.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <h4>Found a hole here</h4>
      <ul className="checks">
        {report.checks.map(([ok, text]) => (
          <li key={text} className={ok ? "ok" : "no"}>
            {ok ? "✓" : "·"} {text}
          </li>
        ))}
      </ul>
      <button className="found-btn" disabled={!report.ready} onClick={onFound}>
        Send a convoy from {s.holeName}
      </button>
    </aside>
  );
}
