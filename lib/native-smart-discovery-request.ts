import {browseFilterControls,hasBrowseFilterControls} from "./browse-filter-controls";
import type {SearchBrowseFilters} from "./browse-filters";

export const NATIVE_DISCOVERY_FILTER_HEADER = "X-CineGenius-Browse-Filters";
/** UTF-8/base64url keeps closed public facet choices out of URLs and supports
 * all catalogue languages. The server still runs its authoritative reader. */
export function encodeNativeDiscoveryFilters(value: SearchBrowseFilters): string | null {
  const filters=browseFilterControls(value);
  if (!hasBrowseFilterControls(filters)) return null;
  const bytes=new TextEncoder().encode(JSON.stringify(filters));
  if (bytes.length>4096) throw new Error("invalid_request");
  return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join("")).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
export function decodeNativeDiscoveryFilters(raw: string): unknown {
  if (!raw || raw.length>5462 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error("invalid_request");
  const bytes=Uint8Array.from(atob(raw.replaceAll("-","+").replaceAll("_","/")),character=>character.charCodeAt(0));
  if (bytes.length>4096) throw new Error("invalid_request");
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
