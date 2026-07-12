/**
 * Tiny console logger for server-side lifecycle visibility. Kept dependency-free
 * and mostly pure (`formatLog` builds the string) so it is trivial to test.
 */

/** Current wall-clock time as HH:MM:SS (from the ISO string, UTC). */
function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

/** Build a log line: `[HH:MM:SS] [scope] msg` with optional JSON-encoded extra. */
export function formatLog(scope: string, msg: string, extra?: object): string {
  const line = `[${timestamp()}] [${scope}] ${msg}`;
  return extra === undefined ? line : `${line} ${JSON.stringify(extra)}`;
}

/** Log an informational line to stdout. */
export function log(scope: string, msg: string, extra?: object): void {
  console.log(formatLog(scope, msg, extra));
}

/** Log an error line to stderr, including the error's stack (or message). */
export function logError(scope: string, msg: string, err: unknown): void {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error(`[${timestamp()}] [${scope}] ${msg}`, detail);
}
