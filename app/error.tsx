"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fehler an Sentry melden
    import("@sentry/nextjs").then(({ captureException }) => {
      captureException(error);
    });
  }, [error]);

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-crimson/10 border border-crimson/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={36} className="text-crimson-light" />
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-text-muted text-base mb-2 leading-relaxed">
          Ein unerwarteter Fehler ist aufgetreten. Das ist kein Problem auf deiner Seite.
        </p>
        {error.digest && (
          <p className="text-text-muted text-xs mb-8 font-mono">
            Fehler-ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} /> Erneut versuchen
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Home size={16} /> Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
