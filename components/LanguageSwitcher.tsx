"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";

const LANGUAGES = [
  { code: "de", label: "Deutsch",  flag: "🇩🇪" },
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "es", label: "Español",  flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "cs", label: "Čeština",  flag: "🇨🇿" },
  { code: "hu", label: "Magyar",   flag: "🇭🇺" },
];

function persistLocaleCookie(code: string) {
  document.cookie = `cg_locale=${code}; path=/; max-age=31536000; samesite=lax`;
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const current = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (code: string) => {
    if (code === current || pending) return;
    setOpen(false);

    // Set cookie directly in the browser first — works even without network
    persistLocaleCookie(code);

    // Cookie is already available to the refresh. Do not delay the switch on a second request.
    startTransition(() => router.refresh());
    void fetch("/api/locale", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({locale: code}),
    }).catch(() => { /* The directly stored cookie remains authoritative. */ });
  };

  const currentLang = LANGUAGES.find((l) => l.code === current);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-text-muted hover:text-gold hover:bg-bg-elevated transition-all text-sm"
        aria-label={t("choose")}
        aria-expanded={open}
        aria-busy={pending}
        disabled={pending}
      >
        <Globe size={15} />
        <span>{currentLang?.flag}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-44 bg-bg-elevated border border-border rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover ${
                current === lang.code ? "text-gold" : "text-text-secondary"
              }`}
            >
              <span className="leading-none">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.label}{lang.code !== "de" && <span className="block text-[10px] text-text-muted">{t("inProgress")}</span>}</span>
              {current === lang.code && <Check size={11} className="text-gold shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
