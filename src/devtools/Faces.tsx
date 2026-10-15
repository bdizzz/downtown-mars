// ?faces: a page of notables' headshots (T-054), to check the faces look varied and on-style.
import raw from "../../data/notables.json";
import { portraitFace, type PortraitPerson } from "../view/portrait";
import { Portrait } from "../ui/Portrait";

const people: PortraitPerson[] = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  name: `${raw.firstNames[(i * 7) % raw.firstNames.length]} ${raw.lastNames[(i * 11) % raw.lastNames.length]}`,
  role: raw.roles[i % raw.roles.length]!,
  traits: [raw.traits[i % raw.traits.length]!, raw.traits[(i * 3 + 1) % raw.traits.length]!],
}));

export function Faces() {
  return (
    <div className="faces-page" style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16, background: "var(--bg, #1a0f0d)", minHeight: "100vh" }}>
      <style>{".faces-page .face { width: 96px; height: 96px; }"}</style>
      {people.map((p) => {
        const f = portraitFace(p);
        return (
          <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 12, textAlign: "center" }}>
            <Portrait who={p} />
            <strong>{p.name}</strong>
            <span className="k">
              {p.role} · {p.traits.join(", ")}
              <br />
              {f.prop ?? "no prop"} · {f.mood}
            </span>
          </div>
        );
      })}
    </div>
  );
}
