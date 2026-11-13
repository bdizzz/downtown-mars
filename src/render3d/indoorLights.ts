import * as THREE from "three";
import type { Layout } from "../sim/placement";
import { overheadLights } from "../view/overheads";
import { LightSwitch, lampDims, lampLevel, overheadLevel, overheadStaysOn, switchDelay, type LightMode } from "../view/lightModes";
import { lightPools, setPoolLevels, type Lamp } from "./lights3d";
import lighting from "../../data/lighting.json";

// Rooms lit by the hour underground (#305), as the Godot viewer's: ceiling lights over each room cell and
// along each corridor, and the lamps brighter by day, some dimmed by night, rooms dark after midnight.
// On the web a ceiling light is a lamp like any other: a pool on the floor under it, and a point light
// when it's among the nearest (LampLights). Its fixture, a glowing disc, shows only in first person.

interface Light {
  lamp: Lamp;
  /** Its pool: a mesh and its index in the lamps that mesh was made from. */
  pools: THREE.Mesh | null;
  index: number;
  overhead: boolean;
  /** Dims (a lamp) or stays on (a ceiling light) at night. */
  night: boolean;
  inRoom: boolean;
  delay: number;
  level: number;
}

const FIXTURE = { radius: lighting.overhead.fixtureRadiusM, off: new THREE.Color(0x4a4640), on: new THREE.Color(lighting.overhead.color) };

export class IndoorLights {
  /** The ceiling lights' pools and fixtures. */
  readonly group = new THREE.Group();
  private lights: Light[] = [];
  private overheadPools: THREE.Mesh | null = null;
  private fixtures: THREE.InstancedMesh | null = null;
  private switch = new LightSwitch();
  /** The lamps lit now, at their strength in the mode, for the point lights. */
  lit: Lamp[] = [];

  /**
   * Gather the lights of a new layout: the furniture's lamps (each room's group holds its lamps and their
   * pools) and a ceiling light per room cell and per stretch of corridor on the floors shown.
   */
  build(layout: Layout, furniture: THREE.Object3D[], topFloor: number | null): void {
    this.clear();
    for (const g of furniture) {
      const lamps = (g.userData.lamps as Lamp[] | undefined) ?? [];
      const pools = (g.children.find((o) => o.userData.pool) as THREE.Mesh | undefined) ?? null;
      lamps.forEach((lamp, index) => this.lights.push(this.light(lamp, pools, index, false)));
    }
    const { room, corridor } = lighting.web;
    const color = lighting.overhead.color;
    const overheads: Lamp[] = overheadLights(layout)
      .filter((o) => topFloor === null || o.floor >= topFloor)
      .map((o) => {
        const k = o.kind === "room" ? room : corridor;
        return { x: o.x, y: o.y, z: o.z, floor: o.floor, px: o.x, pz: o.z, color, reach: k.reachM, strength: k.strength, room: o.kind === "room" ? o.room : undefined };
      });
    this.overheadPools = lightPools(overheads);
    if (this.overheadPools) {
      this.overheadPools.visible = this.showPools;
      this.group.add(this.overheadPools);
    }
    overheads.forEach((lamp, index) => this.lights.push(this.light(lamp, this.overheadPools, index, true)));
    if (overheads.length) {
      const disc = new THREE.CylinderGeometry(FIXTURE.radius, FIXTURE.radius, 0.06, 16);
      this.fixtures = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ toneMapped: false }), overheads.length);
      const m = new THREE.Matrix4();
      overheads.forEach((o, i) => {
        this.fixtures!.setMatrixAt(i, m.makeTranslation(o.x, o.y + 0.03, o.z));
        this.fixtures!.setColorAt(i, FIXTURE.off);
      });
      this.fixtures.visible = this.showFixtures;
      this.group.add(this.fixtures);
    }
    this.switch.reset();
  }

  private light(lamp: Lamp, pools: THREE.Mesh | null, index: number, overhead: boolean): Light {
    const inRoom = lamp.room !== undefined;
    return {
      lamp,
      pools,
      index,
      overhead,
      night: overhead ? overheadStaysOn(lamp.x, lamp.y, lamp.z) : lampDims(lamp.x, lamp.y, lamp.z),
      inRoom,
      delay: switchDelay(lamp.room ?? -1, lamp.x, lamp.y, lamp.z),
      level: -1,
    };
  }

  private showPools = true;
  /** The ceiling lights' pools show whenever lamp light is on at all (a graphics setting). */
  setPoolsShown(on: boolean): void {
    this.showPools = on;
    if (this.overheadPools) this.overheadPools.visible = on;
  }

  private showFixtures = false;
  /** The fixtures show only in first person (from above they'd only clutter); their light shows in every view. */
  setFixturesShown(on: boolean): void {
    this.showFixtures = on;
    if (this.fixtures) this.fixtures.visible = on;
  }

  /** Put the lights in the mode, at real time `nowS` (seconds). True while a switch is still under way. */
  update(mode: LightMode, nowS: number): boolean {
    if (!this.switch.set(mode, nowS)) return false;
    const changed = new Set<THREE.Mesh>();
    let overhead = 0;
    for (const l of this.lights) {
      const m = this.switch.modeOf(l.delay);
      const level = l.overhead ? overheadLevel(m, l.night, l.inRoom) : lampLevel(m, l.night, l.inRoom);
      if (l.overhead) this.fixtures?.setColorAt(overhead++, FIXTURE.off.clone().lerp(FIXTURE.on, Math.min(1, level)));
      if (level === l.level) continue;
      l.level = level;
      if (l.pools) changed.add(l.pools);
    }
    if (this.fixtures?.instanceColor) this.fixtures.instanceColor.needsUpdate = true;
    for (const mesh of changed) {
      const levels = new Map(this.lights.filter((l) => l.pools === mesh).map((l) => [l.index, l.level]));
      setPoolLevels(mesh, (i) => levels.get(i) ?? 1);
    }
    this.lit = this.lights.filter((l) => l.level > 0.01).map((l) => (l.level === 1 ? l.lamp : { ...l.lamp, strength: l.lamp.strength * l.level }));
    return this.switch.switching;
  }

  private clear(): void {
    this.lights = [];
    this.lit = [];
    if (this.overheadPools) this.overheadPools.geometry.dispose();
    if (this.fixtures) {
      this.fixtures.geometry.dispose();
      (this.fixtures.material as THREE.Material).dispose();
      this.fixtures.dispose();
    }
    this.group.clear();
    this.overheadPools = null;
    this.fixtures = null;
  }
}
