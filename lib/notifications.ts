export type NotificationType =
  | "booking_confirmed"
  | "booking_request"
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


export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
}

export const notificationMeta: Record<NotificationType, { color: string; dot: string }> = {
  booking_confirmed:     { color: "text-success",       dot: "bg-success" },
  booking_request:       { color: "text-gold",           dot: "bg-gold" },
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
