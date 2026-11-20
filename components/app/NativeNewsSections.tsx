"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import styles from "./NativeNewsSections.module.css";

export default function NativeNewsSections({ section, country = "" }: { section: "entries" | "organizations"; country?: string }) {
  const native = useNativeAppAppearance(), t = useTranslations("Organizations"), nav = useTranslations("nav");
  if (!native) return null;
  const query = new URLSearchParams({ country: country || "all" });
  return <nav className={`site-container ${styles.sections}`} aria-label={nav("news")} data-native-news-sections>
    <Link href={`/news?${query}`} aria-current={section === "entries" ? "page" : undefined}>{t("entries")}</Link>
    <Link href={`/organizations?${query}`} aria-current={section === "organizations" ? "page" : undefined}>{t("organizations")}</Link>
  </nav>;
}
