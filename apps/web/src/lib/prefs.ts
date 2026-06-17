/** User preferences resolved from cookies (server-side). Pure + testable. */

export const LOW_BANDWIDTH_COOKIE = "lowbw";

export function parseLowBandwidth(cookieValue: string | undefined): boolean {
  return cookieValue === "1";
}

/** Fewer rows over the wire in low-bandwidth mode. */
export function pageSizeFor(lowBandwidth: boolean): number {
  return lowBandwidth ? 6 : 20;
}
