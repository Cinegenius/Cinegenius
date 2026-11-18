/** Fold Latin accents for search, but retain Japanese voicing and compose Korean
 * syllables again. This changes search keys only, never saved member content. */
export function searchTextKey(value: unknown): string {
  return String(value ?? "").normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1").normalize("NFC")
    .toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim();
}

export const occupationTextKey = (value: string) => searchTextKey(value
  .replace(/(?:\*|:|\/)innen\b/giu, "").replace(/(?:\*|:|\/)in\b/giu, "").replace(/\*frau\b/giu, ""));
