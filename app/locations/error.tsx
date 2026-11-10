"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useTranslations } from "next-intl";


const MAX_RETRIES = 2;

export default function LocationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const uiText = useTranslations();

  const [attempts, setAttempts] = useState(0);
  const canRetry = attempts < MAX_RETRIES;

  return (
    <main className="pt-20 min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-crimson/10 border border-crimson/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={30} className="text-crimson-light" />
        </div>
        <h1 className="font-display text-2xl font-bold text-text-primary mb-3">{uiText("Ui.text_4ddee8a08c6667")}</h1>
        <p className="text-text-muted text-sm leading-relaxed mb-5">{uiText("Ui.text_6d8119b3930c35")}</p>
        {error.digest && <p className="text-text-muted text-xs font-mono mb-5">{uiText.rich("Ui.text_963fcbd25b2e27", { value1: () => (error.digest) })}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">{uiText.rich("Ui.text_6f42aa97f5e80c", { value1: () => (canRetry && (
            <button
              type="button"
              onClick={() => { setAttempts((count) => count + 1); reset(); }}
              className="min-h-11 px-5 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
            >{uiText.rich("Ui.text_9d35e20dd05f4d", { part1: () => (<RefreshCw size={15} />), value2: () => (MAX_RETRIES - attempts) })}</button>
          )), part3: () => (<Home size={15} />), part2: chunks => (<Link href="/" className="min-h-11 px-5 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2">{chunks}</Link>) })}</div>
      </div>
    </main>
  );
}
