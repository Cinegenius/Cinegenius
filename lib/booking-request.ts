/** Accept only a confirmed server receipt; never invent a successful request. */
export async function submitBookingRequest(payload: Record<string, unknown>, send: typeof fetch = fetch): Promise<string> {
  const response = await send("/api/bookings", {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload),
  });
  const data: unknown = await response.json();
  if (!response.ok || !data || typeof data !== "object" || !("ref" in data) || typeof data.ref !== "string" || !/^CG-[A-Z0-9]+$/.test(data.ref)) {
    throw new Error("BOOKING_REQUEST_NOT_CONFIRMED");
  }
  return data.ref;
}

/** Calendar dates are local dates, not UTC instants. */
export function bookingDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Preserve the API's existing end-exclusive rental-day convention, including DST. */
export function bookingDays(start: string, end: string): number {
  const difference = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  return Number.isFinite(difference) && difference >= 0 ? Math.max(1, Math.ceil(difference)) : 0;
}
