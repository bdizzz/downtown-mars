/// <reference types="vite/client" />
/**
 * A dev or test build: the dev server (and the /try servers), or a PR's preview build (the preview
 * workflow sets VITE_PR_NUMBER). These offer the dev games (#518) and start with sound off until the
 * player turns it on (#539). A function, so Node scripts can import modules that use it.
 */
export function isDevBuild(): boolean {
  const env = import.meta.env;
  return !!env && (!!env.DEV || /^\d+$/.test(String(env.VITE_PR_NUMBER ?? "")));
}
