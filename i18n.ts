import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED = ["de", "en", "es", "it", "cs", "hu"] as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("cg_locale")?.value ?? "de";
  const locale = (SUPPORTED as readonly string[]).includes(raw) ? raw : "de";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
