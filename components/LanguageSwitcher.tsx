"use client";

import { useState, useRef, useEffect, useTransition, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ContentTranslationChoice } from "@/components/ContentTranslation";
import { Check } from "lucide-react";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/locales";

const LANGUAGES = LANGUAGE_OPTIONS;

function persistLocaleCookie(code: string) {
  document.cookie = `cg_locale=${code}; path=/; max-age=31536000; samesite=lax`;
}

export default function LanguageSwitcher({ inline = false }: { inline?: boolean }) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const languageUpdates = useRef<Promise<unknown>>(Promise.resolve());

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
    languageUpdates.current = languageUpdates.current.catch(() => undefined).then(() => fetch("/api/locale", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({locale: code, persistOnly: true}),
    })).catch(() => { /* The directly stored cookie remains authoritative. */ });
  };

  const currentLang = LANGUAGES.find((l) => l.code === current);

  return (
    <div className="relative min-w-0" ref={ref} onKeyDown={event => {
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); buttonRef.current?.focus(); }
    }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 shrink-0 items-center rounded-md text-text-muted hover:text-gold hover:bg-bg-elevated transition-colors ${inline ? "w-full gap-3 px-2 text-sm" : "w-11 justify-center text-lg"}`}
        aria-label={t("choose")}
        aria-expanded={open}
        aria-controls={panelId}
        aria-busy={pending}
        disabled={pending}
      >
        <span aria-hidden="true">{currentLang?.flag}</span>{inline && <span className="min-w-0 break-words text-left">{t("choose")} · {currentLang?.label}</span>}
      </button>

      {open && (
        <div id={panelId} className={`${inline ? "relative w-full" : "absolute top-full right-0 w-56 max-w-[calc(100vw-2rem)]"} mt-1.5 max-h-[70dvh] overflow-y-auto overscroll-contain browse-popup-surface border border-border rounded-lg shadow-xl z-50`}>
          <ContentTranslationChoice />
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => select(lang.code)}
              aria-current={current === lang.code ? "true" : undefined}
              className={`w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-bg-hover ${
                current === lang.code ? "text-gold" : "text-text-secondary"
              }`}
            >
              <span className="leading-none">{lang.flag}</span>
              <span className="flex-1 min-w-0 break-words text-left">{lang.label}</span>
              {current === lang.code && <Check size={11} className="text-gold shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
