import { redirect } from "next/navigation";

/** Preserve saved links while keeping all inbox sections in one persistent page. */
export default function NotificationsPage() {
  redirect("/messages?view=notices");
}
