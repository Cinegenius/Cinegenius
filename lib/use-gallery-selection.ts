"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/** URLs identify photos across a reordered or refreshed gallery; array offsets do not. */
export function useGallerySelection(images: string[]): [number | null, Dispatch<SetStateAction<number | null>>] {
  const [selected, setSelected] = useState<string | null>(null);
  const index = selected === null || !images.length ? null : Math.max(0, images.indexOf(selected));
  const select: Dispatch<SetStateAction<number | null>> = action => setSelected(current => {
    const previous = current === null ? null : Math.max(0, images.indexOf(current));
    const next = typeof action === "function" ? action(previous) : action;
    return next === null ? null : images[next] ?? null;
  });
  return [index, select];
}
