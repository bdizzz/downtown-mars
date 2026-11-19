// Just enough of a browser for the web game's 3D builders to run in Node: they draw room labels and
// construction stripes on canvases, which the Godot viewer doesn't use (it has its own labels).

const noop: object = new Proxy(function () {}, {
  get: (_t, key) => (key === "measureText" ? () => ({ width: 0 }) : noop),
  set: () => true,
  // Calls hand back the stand-in too, so a gradient (createLinearGradient(…).addColorStop) works.
  apply: () => noop,
});

const g = globalThis as unknown as { document?: unknown };
g.document ??= {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }),
};
