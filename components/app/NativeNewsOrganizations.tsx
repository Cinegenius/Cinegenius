import { organizationDiscovery, type PublicOrganization } from "@/lib/organization-discovery";
import { organizationsCountryHref } from "@/lib/browse-country";
import { NativeNewsOrganizationRail } from "./NativeNews";

/** Optional streamed source icons; news entries never await this separate read. */
export default async function NativeNewsOrganizations({ country }: { country: string }) {
  const href = organizationsCountryHref(country);
  let organizations: PublicOrganization[] = [], unavailable = false;
  try {
    organizations = (await organizationDiscovery(1, 12, country, AbortSignal.timeout(8000))).organizations;
  } catch {
    unavailable = true;
  }
  return <NativeNewsOrganizationRail organizations={organizations} href={href} unavailable={unavailable} />;
}
