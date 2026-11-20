"use client";

import { useRouter } from "next/navigation";
import NativeCountrySelect from "@/components/app/NativeCountrySelect";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { browseCountryChoice, organizationsCountryHref } from "@/lib/browse-country";

export default function NativeOrganizationCountryFilter({ country }: { country: string }) {
  const native = useNativeAppAppearance(), router = useRouter();
  if (!native) return null;
  return <div className="mb-3" data-native-organization-country>
    <NativeCountrySelect value={country} onChange={value => {
      const next = browseCountryChoice(value);
      if (next !== undefined) router.push(organizationsCountryHref(next || 'all'), { scroll: false });
    }} />
  </div>;
}
