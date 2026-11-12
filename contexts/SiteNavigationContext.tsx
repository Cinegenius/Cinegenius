"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const Context = createContext<{ menuOpen: boolean; openMenu: () => void; closeMenu: () => void } | null>(null);

export function SiteNavigationProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const value = useMemo(() => ({ menuOpen, openMenu, closeMenu }), [menuOpen, openMenu, closeMenu]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSiteNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("Site navigation requires SiteNavigationProvider");
  return value;
}
