export type NotificationType =
  | "booking_confirmed"
  | "booking_request"
  | "booking_rejected"
  | "new_message"
  | "new_application"
  | "application_sent"
  | "review_request"
  | "payout_ready"
  | "verification_approved"
  | "verification_pending"
  | "friend_request"
  | "friend_accepted";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string; // ISO
}


export function timeAgo(iso: string, locale = "de"): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff)) return "";
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.trunc(diff / 60_000);
  if (Math.abs(minutes) < 1) return formatter.format(0, "second");
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.trunc(minutes / 60);
  return Math.abs(hours) < 24 ? formatter.format(hours, "hour") : formatter.format(Math.trunc(hours / 24), "day");
}

export const notificationMeta: Record<NotificationType, { color: string; dot: string }> = {
  booking_confirmed:     { color: "text-success",       dot: "bg-success" },
  booking_request:       { color: "text-gold",           dot: "bg-gold" },
  booking_rejected:      { color: "text-crimson-light",  dot: "bg-crimson" },
  new_message:           { color: "text-blue-400",       dot: "bg-blue-400" },
  new_application:       { color: "text-gold",           dot: "bg-gold" },
  application_sent:      { color: "text-blue-400",       dot: "bg-blue-400" },
  review_request:        { color: "text-purple-400",     dot: "bg-purple-400" },
  payout_ready:          { color: "text-success",        dot: "bg-success" },
  verification_approved: { color: "text-success",        dot: "bg-success" },
  verification_pending:  { color: "text-text-muted",     dot: "bg-text-muted" },
  friend_request:        { color: "text-gold",            dot: "bg-gold" },
  friend_accepted:       { color: "text-success",         dot: "bg-success" },
};
