import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED = ["de", "en", "es", "it", "cs", "hu"] as const;
type Locale = (typeof SUPPORTED)[number];

async function loadMessages(locale: Locale) {
  switch (locale) {
    case "de": return (await import("./messages/de.json")).default;
    case "en": return (await import("./messages/en.json")).default;
    case "es": return (await import("./messages/es.json")).default;
    case "it": return (await import("./messages/it.json")).default;
    case "cs": return (await import("./messages/cs.json")).default;
    case "hu": return (await import("./messages/hu.json")).default;
  }
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("cg_locale")?.value ?? "de";
  const locale = (SUPPORTED as readonly string[]).includes(raw) ? (raw as Locale) : "de";

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
