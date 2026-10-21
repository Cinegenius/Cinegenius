"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "cg_cookies_ok";
const CHANGE_EVENT = "cg-cookie-preference-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  return !localStorage.getItem(STORAGE_KEY);
}

export default function CookieBanner() {
  const t = useTranslations("cookie");
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => false);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 right-0 z-50 bg-bg-elevated border-t border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 shadow-2xl">
      <p className="text-sm text-text-secondary flex-1 leading-relaxed">
        {t("text")}{" "}
        <Link href="/datenschutz" className="text-gold hover:underline whitespace-nowrap">
          {t("link")}
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm shrink-0"
      >
        {t("cta")} <X size={13} />
      </button>
    </div>
  );
}
