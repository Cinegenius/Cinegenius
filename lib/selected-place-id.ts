/** Draft transport only. The server verifies the selected catalogue ID against
 * the complete country/region/name path before writing canonical place fields. */
export function selectedPlaceId(value: unknown): string {
  return typeof value === "string" && /^geonames:[0-9]+$/.test(value) ? value : "";
}
