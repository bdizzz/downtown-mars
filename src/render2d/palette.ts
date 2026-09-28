// Room colours by category, shared by the Pixi view and the React palette.
export const CATEGORY_COLORS: Record<string, number> = {
  housing: 0x6f93bd,
  food: 0x86ad58,
  water: 0x4f9fc8,
  air: 0x8cc8cf,
  health: 0xd48092,
  admin: 0xc9a456,
  power: 0xe0bf4a,
  logistics: 0xa08fb0,
  circulation: 0x9a8574,
  industry: 0xb48a6a,
  public: 0xd9a870,
  construction: 0xd98c3a,
  storage: 0x9c8a6a,
};

export const cssColor = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Overlay colours: red/green, or orange/blue for colour-blind players. */
export const HEAT = {
  normal: { bad: 0xff4a2e, good: 0x5fe07a },
  colorBlind: { bad: 0xf08a24, good: 0x3f8fff },
};
