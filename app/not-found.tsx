import Link from "next/link";
import { Film, Home, Search } from "lucide-react";
import { useTranslations } from "next-intl";


export default function NotFound() {
  const uiText = useTranslations();

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

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">{uiText("Ui.text_4d25c24500cc60")}</h1>
        <p className="text-text-muted text-lg mb-2">{uiText("Ui.text_26936b4cb9131a")}</p>
        <p className="text-text-muted text-sm mb-10">{uiText("Ui.text_eba20ce9a35216")}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">{uiText.rich("Ui.text_e1d9a30afcdd04", { part2: () => (<Home size={16} />), part1: chunks => (<Link
            href="/"
            className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >{chunks}</Link>), part4: () => (<Search size={16} />), part3: chunks => (<Link
            href="/locations"
            className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
          >{chunks}</Link>) })}</div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-text-muted text-xs mb-4">{uiText("Ui.text_f68e7a98be6197")}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: uiText("Ui.text_e512dbd2b58a8b"), href: "/props" },
              { label: uiText("footer.links_filmJobs"), href: "/jobs" },
              { label: uiText("search.typeCreators"), href: "/creators" },
              { label: uiText("nav.marketplace"), href: "/marketplace" },
              { label: uiText("Ui.text_95472f650a2b64"), href: "/help" },
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
