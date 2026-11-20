"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import BrowseSelect from "@/components/BrowseSelect";
import { COUNTRY_CODES } from "@/lib/places/countries";
import { countryName, UNASSIGNED_COUNTRY } from "@/lib/places/core";
import styles from "./NativeCountrySelect.module.css";
import { NativeBrowseQuickFilter } from "./NativeBrowseToolbar";

/** Caller supplies the native-only boundary; choices reuse the shared country catalogue. */
export default function NativeCountrySelect({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  const locale = useLocale(), places = useTranslations("Places"), region = useTranslations("NewsRegion");
  const options = useMemo(() => [
    { value: "all", label: places("allCountries") },
    { value: UNASSIGNED_COUNTRY, label: region("unassignedCountry") },
    ...COUNTRY_CODES.map(code => ({ value: code, label: countryName(code, locale) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
  ], [locale, places, region]);
  if (compact) return <NativeBrowseQuickFilter kind="country" label={places("country")} value={value || "all"} options={options} onChange={onChange} />;
  return <div className={styles.select} data-native-country-select>
    <BrowseSelect label={places("country")} value={value || "all"} options={options}
      icon={<Globe size={17} aria-hidden="true" />} onChange={onChange} />
  </div>;
}
