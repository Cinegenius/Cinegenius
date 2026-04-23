"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "cg_cookies_ok";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 right-0 z-50 bg-bg-elevated border-t border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 shadow-2xl">
      <p className="text-sm text-text-secondary flex-1 leading-relaxed">
        Diese Seite nutzt ausschließlich technisch notwendige Cookies für Login und Spracheinstellung — keine Tracking- oder Werbe-Cookies.{" "}
        <Link href="/datenschutz" className="text-gold hover:underline whitespace-nowrap">
          Datenschutzerklärung
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm shrink-0"
      >
        Verstanden <X size={13} />
      </button>
    </div>
  );
}
