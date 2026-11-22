// Bounded private-test hypothesis only; no output/source-fact repair or retry.
import {validateDocument} from './core.mjs';
export function personalDispoOriginalOutputLimit(originalDocument) {
  try {
    validateDocument(originalDocument);
    if (originalDocument.pages.length > 100) return 24000;
    const sourceUTF16 = originalDocument.pages.reduce((sum,page) => sum + page.text.length, 0);
    if (!Number.isSafeInteger(sourceUTF16) || sourceUTF16 < 1 || sourceUTF16 > 250000) return 24000;
    return Math.min(24000, Math.max(8000, 4 * sourceUTF16));
  } catch { return 24000; }
}
