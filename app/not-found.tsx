import Link from "next/link";
import { Film, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* 404 */}
        <div className="relative mb-6">
          <div
            className="font-display text-[12rem] font-bold leading-none select-none"
            style={{ color: "transparent", WebkitTextStroke: "2px #2e2e2e" }}
          >
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center">
              <Film size={32} className="text-gold" />
            </div>
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
          Szene nicht gefunden
        </h1>
        <p className="text-text-muted text-lg mb-2">
          Diese Seite wurde wohl im Schneideraum vergessen.
        </p>
        <p className="text-text-muted text-sm mb-10">
          Die URL stimmt möglicherweise nicht, die Seite wurde verschoben oder existiert nicht.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >
            <Home size={16} /> Zur Startseite
          </Link>
          <Link
            href="/locations"
            className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Search size={16} /> Drehorte entdecken
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-text-muted text-xs mb-4">Oder direkt zu:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: "Requisiten & Verleih", href: "/props" },
              { label: "Film Jobs", href: "/jobs" },
              { label: "Filmschaffende", href: "/creators" },
              { label: "Marktplatz", href: "/marketplace" },
              { label: "Hilfe", href: "/help" },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-xs text-text-muted border border-border rounded-full hover:border-gold hover:text-gold transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
