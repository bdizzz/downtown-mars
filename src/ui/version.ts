declare const __APP_VERSION__: string;

/** e.g. "v0.2.0 · 1a2b3c4", injected at build time by vite.config.ts. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
