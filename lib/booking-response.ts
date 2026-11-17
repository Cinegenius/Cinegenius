/** Only a confirmed server acknowledgement may change a visible booking status. */
export async function respondToBooking(id: string, status: "confirmed" | "rejected", signal?: AbortSignal) {
  const response = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
    method: "PATCH", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true || result.status !== status) throw new Error("booking_response_unconfirmed");
  return status;
}
