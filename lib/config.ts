/**
 * Central place for the safety mode.
 *
 * The application can only *prepare* applications (inspect the form, generate
 * drafts, pause for approval). It never submits. Because that is the only mode
 * that exists, a missing APPLICATION_MODE variable is treated as PREPARE_ONLY
 * instead of rejecting every action. Only an explicit, different value (for
 * example "AUTO_SUBMIT") is refused.
 */
export const SAFE_MODE = "PREPARE_ONLY";

export function applicationMode(): string {
  const raw = process.env.APPLICATION_MODE?.trim();
  return raw ? raw : SAFE_MODE;
}

export function isSafeMode(): boolean {
  return applicationMode() === SAFE_MODE;
}
