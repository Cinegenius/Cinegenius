"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useTranslations } from "next-intl";


export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const uiText = useTranslations();

  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-crimson/10 border border-crimson/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={36} className="text-crimson-light" />
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">{uiText("Ui.text_6c52e3f2ffd72a")}</h1>
        <p className="text-text-muted text-base mb-2 leading-relaxed">{uiText("Ui.text_7561dc46516e33")}</p>
        {error.digest && (
          <p className="text-text-muted text-xs mb-8 font-mono">{uiText.rich("Ui.text_963fcbd25b2e27", { value1: () => (error.digest) })}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >{uiText.rich("Ui.text_ef819e77cdacca", { part1: () => (<RefreshCw size={16} />) })}</button>
          <Link
            href="/"
            className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
          >{uiText.rich("Ui.text_f568e8ed797fc0", { part1: () => (<Home size={16} />) })}</Link>
        </div>
      </div>
    </div>
  );
}
