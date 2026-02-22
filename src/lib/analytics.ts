/**
 * Safely sends an event to Google Analytics (gtag.js).
 * If the GA script failed to load (e.g. adblocker) or an error occurs,
 * this function catches the error silently to prevent application crashes.
 *
 * @param eventName The name of the event (e.g., 'scan_device')
 * @param eventParams Optional parameters to send with the event
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
    try {
        if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
            (window as any).gtag('event', eventName, eventParams);
        } else {
            // For development / debugging or when blocked
            // console.debug(`[Analytics] Mock event tracked: ${eventName}`, eventParams);
        }
    } catch (error) {
        // Silently catch errors related to analytics to avoid interrupting the main flow
        console.warn(`[Analytics] Failed to track event: ${eventName}`, error);
    }
}
