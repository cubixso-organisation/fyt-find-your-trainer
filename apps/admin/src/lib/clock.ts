import "server-only";

/**
 * Request-time clock for server components. Pages render per request, so
 * reading the time here is intentional; keeping it in one place makes the
 * clock mockable for tests and demo snapshots.
 */
export function requestTime(): number {
  return Date.now();
}
