"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";

const LANGUAGES = [
  { code: "de", label: "Deutsch",    flag: "🇩🇪" },
  { code: "en", label: "English",    flag: "🇬🇧" },
  { code: "es", label: "Español",    flag: "🇪🇸" },
  { code: "it", label: "Italiano",   flag: "🇮🇹" },
  { code: "cs", label: "Čeština",    flag: "🇨🇿" },
  { code: "hu", label: "Magyar",     flag: "🇭🇺" },
];

function getStoredLocale(): string {
  if (typeof document === "undefined") return "de";
  return document.cookie.match(/cg_locale=([^;]+)/)?.[1] ?? "de";
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("de");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setCurrent(getStoredLocale());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = async (code: string) => {
    if (code === current || loading) return;
    setLoading(true);
    setOpen(false);
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: code }),
    });
    setCurrent(code);
    setLoading(false);
    router.refresh();
  };

  const currentLang = LANGUAGES.find((l) => l.code === current);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-text-muted hover:text-gold hover:bg-bg-elevated transition-all text-sm"
        aria-label="Sprache wählen"
      >
        <Globe size={15} />
        <span className="hidden sm:inline font-medium">{currentLang?.flag} {currentLang?.label}</span>
        <span className="sm:hidden">{currentLang?.flag}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-44 bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-bg-hover ${
                current === lang.code ? "text-gold" : "text-text-secondary"
              }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.label}</span>
              {current === lang.code && <Check size={13} className="text-gold shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
