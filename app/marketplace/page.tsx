import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Package, Car, Shirt, Wrench, Clapperboard, Sparkles,
  Lightbulb, Mic, Zap, Layers, MapPin, Tag, Plus,
} from "lucide-react";
import { db } from "@/lib/db";
import CategoryHero from "@/components/CategoryHero";

export const metadata: Metadata = {
  title: "Marktplatz — Equipment & Requisiten",
  description: "Kamera-Equipment, Fahrzeuge, Requisiten und mehr kaufen oder mieten — der Marktplatz für Filmproduktionen im DACH-Raum.",
};

export const revalidate = 60;

// ─── Sidebar categories ───────────────────────────────────────────────────────

const SIDEBAR = [
  { slug: "alle",      label: "Alle Artikel",  icon: Layers,      type: null,      catMatch: null },
  { slug: "kostueme",  label: "Kostüme",        icon: Shirt,       type: "prop",    catMatch: "kostüm" },
  { slug: "requisiten",label: "Requisiten",     icon: Package,     type: "prop",    catMatch: null },
  { slug: "fahrzeuge", label: "Fahrzeuge",      icon: Car,         type: "vehicle", catMatch: null },
  { slug: "kamera",    label: "Kamera",         icon: Clapperboard,type: "prop",    catMatch: "kamera" },
  { slug: "licht",     label: "Licht",          icon: Lightbulb,   type: "prop",    catMatch: "licht" },
  { slug: "ton",       label: "Ton",            icon: Mic,         type: "prop",    catMatch: "ton" },
  { slug: "rigging",   label: "Rigging",        icon: Wrench,      type: "prop",    catMatch: "rigging" },
  { slug: "sfx",       label: "SFX",            icon: Zap,         type: "prop",    catMatch: "sfx" },
  { slug: "custom",    label: "Custom",         icon: Sparkles,    type: null,      catMatch: null, href: "/marketplace/commission" },
];

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getListings(cat: string) {
  const entry = SIDEBAR.find((s) => s.slug === cat) ?? SIDEBAR[0];

  let query = db
    .from("listings")
    .select("id, type, title, category, city, price, image_url, metadata")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(60);

  if (entry.type) {
    query = query.eq("type", entry.type);
  } else if (cat !== "alle" && cat !== "custom") {
    query = query.in("type", ["prop", "vehicle"]);
  } else {
    query = query.in("type", ["prop", "vehicle"]);
  }

  if (entry.catMatch) {
    query = query.ilike("category", `%${entry.catMatch}%`);
  }

  const { data } = await query;
  return data ?? [];
}

async function getCounts() {
  const { count } = await db
    .from("listings")
    .select("*", { count: "exact", head: true })
    .in("type", ["prop", "vehicle"])
    .eq("published", true);
  return count ?? 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat = "alle" } = await searchParams;
  const activeSlug = SIDEBAR.find((s) => s.slug === cat) ? cat : "alle";

  const [listings, total] = await Promise.all([
    getListings(activeSlug),
    getCounts(),
  ]);

  const activeEntry = SIDEBAR.find((s) => s.slug === activeSlug)!;

  return (
    <div className="min-h-screen">
      <CategoryHero
        badge="Marktplatz"
        title="Requisiten, Kameras,"
        titleHighlight="Licht & Equipment"
        description="Von Privatpersonen und Verleihfirmen — alles für Film, Fotografie und Social Media Produktion."
        image="https://images.unsplash.com/photo-1431068799455-80bae0caf685?w=1600&q=90"
        imagePosition="center 50%"
        overlay="left"
        height="sm"
        cta={{ label: "Inserat erstellen →", href: "/inserat" }}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8 items-start">

          {/* ── Left sidebar ── */}
          <aside className="cat-sidebar w-44 shrink-0 sticky top-20">
            <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3 px-2">
              Kategorien
            </p>
            <nav className="space-y-0.5">
              {SIDEBAR.map(({ slug, label, icon: Icon, href }) => {
                const isActive = slug === activeSlug;
                const dest = href ?? `/marketplace?cat=${slug}`;
                return (
                  <Link
                    key={slug}
                    href={dest}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-gold" : "text-text-muted"} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 pt-5 border-t border-border">
              <Link
                href="/inserat"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gold hover:bg-gold/10 rounded-lg transition-colors font-medium"
              >
                <Plus size={14} />
                Inserat erstellen
              </Link>
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">

            {/* Mobile category pills */}
            <div className="cat-pills gap-2 overflow-x-auto pb-3 mb-5" style={{ scrollbarWidth: "none" }}>
              {SIDEBAR.map(({ slug, label, href }) => {
                const isActive = slug === activeSlug;
                const dest = href ?? `/marketplace?cat=${slug}`;
                return (
                  <Link
                    key={slug}
                    href={dest}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                      isActive
                        ? "bg-gold/10 text-gold border-gold/40"
                        : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* Count header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-text-muted">
                <span className="text-text-primary font-semibold">{listings.length}</span>
                {" "}Artikel{activeSlug !== "alle" && <> in <span className="text-text-primary">{activeEntry.label}</span></>}
                <span className="text-text-muted/50 ml-2">· {total.toLocaleString("de-DE")} gesamt</span>
              </p>
            </div>

            {/* ── List rows ── */}
            {listings.length === 0 ? (
              <div className="py-20 text-center border border-border rounded-xl bg-bg-secondary">
                <p className="text-text-muted text-sm">Noch keine Artikel in dieser Kategorie.</p>
                <Link href="/inserat" className="inline-flex items-center gap-1.5 mt-4 text-gold text-sm hover:underline">
                  <Plus size={14} /> Erstes Inserat erstellen
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {listings.map((item) => {
                  const href = item.type === "vehicle" ? `/vehicles/${item.id}` : `/props/${item.id}`;
                  const rentalType = (item.metadata as Record<string, unknown> | null)?.rental_type as string | undefined;
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      className="flex items-center gap-4 p-3 rounded-xl border border-border bg-bg-elevated hover:border-gold/30 hover:bg-bg-secondary transition-all group"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-bg-secondary">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.title}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted">
                            <Package size={20} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate group-hover:text-gold transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {item.city && (
                            <span className="flex items-center gap-1 text-[11px] text-text-muted">
                              <MapPin size={10} /> {item.city}
                            </span>
                          )}
                          {item.category && (
                            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border text-text-muted">
                              <Tag size={9} /> {item.category}
                            </span>
                          )}
                          {rentalType === "verkauf" && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-gold/30 text-gold bg-gold/5">
                              Kauf
                            </span>
                          )}
                          {rentalType === "miete" || !rentalType ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-text-muted">
                              Verleih
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gold">
                          {item.price.toLocaleString("de-DE")} €
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {rentalType === "verkauf" ? "VB" : "/Tag"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
