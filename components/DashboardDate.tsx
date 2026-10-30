"use client";

import { useFormatter, useNow } from "next-intl";

export default function DashboardDate() {
  // Share the request's clock across SSR/hydration, including around midnight.
  const now = useNow({ updateInterval: 60_000 });
  const format = useFormatter();

  return (
    <time dateTime={now.toISOString()}>
      {format.dateTime(now, {
        timeZone: "Europe/Berlin",
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    </time>
  );
}
