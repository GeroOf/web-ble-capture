/** Application actions remain local; no analytics are transmitted. */
export function trackEvent(_eventName: string, _eventParams?: Record<string, unknown>): void {
  // External event transmission is disabled by the application communication policy.
}
