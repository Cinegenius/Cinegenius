"use client";
import { useNativeAppAppearance } from "./use-native-app-appearance";
import { useViewState } from "./use-view-state";
import { type BrowseRadius } from "./browse-radius";
export function useNativeBrowseRadius(key: string, city: string) {
  const native = useNativeAppAppearance();
  const [saved, setRadius] = useViewState<BrowseRadius | null>(`${key}.nativeRadius`, null);
  return [native && saved?.city === city ? saved : null, setRadius] as const;
}
