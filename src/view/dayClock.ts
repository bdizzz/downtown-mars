// The view's own clock for the sun and sky (#567): each sim tick is a keyframe, and between them the
// time of day glides, so the sun, its light and the shadows move smoothly at every frame instead of
// stepping once a tick. It runs a tick behind the sim: on each new tick it heads from wherever it is
// now to that tick, taking as long as ticks have lately taken to arrive, so it never runs ahead of the
// sim (pausing stops it on the last tick, exactly) and never jumps backward. A big jump (a load, a skip
// ahead, a new game) snaps straight there. Pure: no rendering; the web stage (render3d/stage3d.ts)
// feeds it each snapshot's tick and asks it where it is every frame.

export interface DayClockOptions {
  /** Real time between ticks at 1× (ms), the first guess before any have been timed. */
  tickMs: number;
  /** A gap longer than this between ticks (ms) is a pause or a hitch, not the pace: it doesn't count towards it. */
  maxTickMs: number;
  /** More ticks than this at once is a jump (a load, a skip ahead): snap instead of gliding. */
  snapTicks: number;
}

/** How much each newly timed tick moves the guess at the pace (0..1). */
const PACE_WEIGHT = 0.5;

export class DayClock {
  /** Where the current glide starts and ends (ticks), and when (ms) and for how long it runs. */
  private from = 0;
  private to = 0;
  private startMs = 0;
  private spanMs = 0;
  /** When the last new tick arrived (ms), and the guess at real time per tick. */
  private lastMs = 0;
  private paceMs: number;
  private started = false;

  constructor(private readonly opts: DayClockOptions) {
    this.paceMs = opts.tickMs;
  }

  /** Forget the past: the next tick snaps (a new game, a loaded save). */
  reset(): void {
    this.started = false;
  }

  /** A snapshot's tick, arriving at `now` (ms). */
  keyframe(tick: number, now: number): void {
    if (this.started && tick === this.to) return;
    const ticks = tick - this.to;
    if (!this.started || ticks < 0 || ticks > this.opts.snapTicks) {
      this.from = this.to = tick;
      this.spanMs = 0;
      this.lastMs = now;
      this.started = true;
      return;
    }
    const perTick = (now - this.lastMs) / ticks;
    if (perTick <= this.opts.maxTickMs) this.paceMs += (perTick - this.paceMs) * PACE_WEIGHT;
    this.from = this.at(now);
    this.to = tick;
    this.startMs = now;
    // As long as the new ticks took to come: any way still to go from the last glide is made up on the way.
    this.spanMs = this.paceMs * ticks;
    this.lastMs = now;
  }

  /** Where the view's clock stands at `now` (ms), in ticks: between the last two keyframes. */
  at(now: number): number {
    if (this.spanMs <= 0) return this.to;
    const k = Math.min(1, Math.max(0, (now - this.startMs) / this.spanMs));
    return this.from + (this.to - this.from) * k;
  }

  /** Whether it's still on its way to the latest tick. */
  moving(now: number): boolean {
    return this.spanMs > 0 && now - this.startMs < this.spanMs;
  }

  /** The latest tick it was given. */
  get latest(): number {
    return this.to;
  }
}

/** A snapshot's time of day (0..1) moved back by however far the view's clock is behind its tick. */
export function smoothDayFraction(dayFraction: number, behindTicks: number, ticksPerDay: number): number {
  const f = dayFraction - behindTicks / ticksPerDay;
  return f - Math.floor(f);
}
