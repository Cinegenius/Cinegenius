import { getLocale, getTranslations } from "next-intl/server";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Metadata")]);
  return {
    name: "CineGenius",
    short_name: "CineGenius",
    description: t("manifestDescription"),
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["business", "entertainment"],
    lang: locale,
  };
}
