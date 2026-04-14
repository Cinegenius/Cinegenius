import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Image from "next/image";
import {
  Package, Car, Shirt, Wrench, Clapperboard, Sparkles, Lightbulb, Mic, Zap, Layers,
  ArrowRight, Search,
} from "lucide-react";
import CategoryHero from "@/components/CategoryHero";
export const dynamic = "force-dynamic";

async function getMarketplaceData() {
  const [{ data: dbProps }, { data: dbVehicles }, { count: totalProps }, { count: totalVehicles }] = await Promise.all([
    supabaseAdmin
      .from("listings")
      .select("id, title, price, category, image_url, city")
      .in("type", ["prop", "vehicle"])
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("listings")
      .select("id, title, price, category, image_url, city")
      .eq("type", "vehicle")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(4),
    supabaseAdmin
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("type", "prop")
      .eq("published", true),
    supabaseAdmin
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("type", "vehicle")
      .eq("published", true),
  ]);

  const liveItems = (dbProps ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    image: r.image_url ?? "",
    category: r.category ?? "Requisite",
    condition: "Gut",
    dailyRate: r.price,
    href: `/props/${r.id}`,
  }));

  return {
    liveItems,
    propCount: totalProps ?? 0,
    vehicleCount: totalVehicles ?? 0,
  };
}

const kategorien = [
  {
    icon: Shirt,
    label: "Kostüme",
    desc: "Historische und moderne Kostüme, Uniformen und Accessoires für alle Epochen.",
    href: "/props?cat=kostueme",
    count: "3.400+",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    iconColor: "text-rose-400",
    glow: "group-hover:shadow-lg group-hover:shadow-rose-500/50",
    accent: "from-rose-900/30",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80",
  },
  {
    icon: Package,
    label: "Requisiten",
    desc: "Set-Dressing, Möbel, Alltagsgegenstände und historische Props.",
    href: "/props",
    count: "12.000+",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    iconColor: "text-violet-400",
    glow: "group-hover:shadow-lg group-hover:shadow-violet-500/50",
    accent: "from-violet-900/30",
    image: "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=600&q=80",
  },
  {
    icon: Car,
    label: "Fahrzeuge",
    desc: "Classic Cars, Military Vehicles, Stunt-Autos und Vintage-Fahrzeuge.",
    href: "/vehicles",
    count: "1.200+",
    iconBg: "bg-orange-500/10 border-orange-500/20",
    iconColor: "text-orange-400",
    glow: "group-hover:shadow-lg group-hover:shadow-orange-500/50",
    accent: "from-orange-900/30",
    image: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80",
  },
  {
    icon: Clapperboard,
    label: "Kamera",
    desc: "Kameras, Objektive, Rigs, Stative und Tracking-Systeme.",
    href: "/props?cat=kamera",
    count: "5.800+",
    iconBg: "bg-sky-500/10 border-sky-500/20",
    iconColor: "text-sky-400",
    glow: "group-hover:shadow-lg group-hover:shadow-sky-500/50",
    accent: "from-sky-900/30",
    image: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=600&q=80",
  },
  {
    icon: Lightbulb,
    label: "Licht",
    desc: "LED Panels, Fresnel, HMI, Softboxen und Diffusionsmaterial.",
    href: "/props?cat=licht",
    count: "2.900+",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    glow: "group-hover:shadow-lg group-hover:shadow-amber-500/50",
    accent: "from-amber-900/30",
    image: "https://images.unsplash.com/photo-1518364538800-6bae3c2ea0f2?w=600&q=80",
  },
  {
    icon: Mic,
    label: "Ton",
    desc: "Boom-Mikrofone, Wireless-Sets, Recorder und Monitoring-Equipment.",
    href: "/props?cat=ton",
    count: "1.400+",
    iconBg: "bg-teal-500/10 border-teal-500/20",
    iconColor: "text-teal-400",
    glow: "group-hover:shadow-lg group-hover:shadow-teal-500/50",
    accent: "from-teal-900/30",
    image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&q=80",
  },
  {
    icon: Wrench,
    label: "Rigging",
    desc: "Kran, Dolly, Track, Motion Control und Bühnentechnik.",
    href: "/props?cat=rigging",
    count: "900+",
    iconBg: "bg-cyan-500/10 border-cyan-500/20",
    iconColor: "text-cyan-400",
    glow: "group-hover:shadow-lg group-hover:shadow-cyan-500/50",
    accent: "from-cyan-900/30",
    image: "https://images.unsplash.com/photo-1518364538800-6bae3c2ea0f2?w=600&q=80",
  },
  {
    icon: Zap,
    label: "SFX",
    desc: "Pyrotechnik, Atmosphären-Equipment, Regen- und Windmaschinen.",
    href: "/props?cat=sfx",
    count: "320+",
    iconBg: "bg-yellow-500/10 border-yellow-500/20",
    iconColor: "text-yellow-400",
    glow: "group-hover:shadow-lg group-hover:shadow-yellow-500/50",
    accent: "from-yellow-900/30",
    image: "https://images.unsplash.com/photo-1518364538800-6bae3c2ea0f2?w=600&q=80",
  },
  {
    icon: Sparkles,
    label: "Custom",
    desc: "Maßgefertigte Requisiten von verifizierten Handwerkern nach deinen Vorgaben.",
    href: "/marketplace/commission",
    count: "190+",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-400",
    glow: "group-hover:shadow-lg group-hover:shadow-emerald-500/50",
    accent: "from-emerald-900/20",
    image: "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=600&q=80",
    featured: true,
  },
];

export default async function MarketplacePage() {
  const { liveItems, propCount, vehicleCount } = await getMarketplaceData();

  return (
    <div className="pt-16 min-h-screen">
      <CategoryHero
        badge="Marktplatz"
        title="Kostüme, Kameras, Licht,"
        titleHighlight="Fahrzeuge & mehr"
        description={`${propCount + vehicleCount > 0 ? `${(propCount + vehicleCount).toLocaleString()} Artikel` : "Tausende Artikel"} von verifizierten Anbietern — kaufen, mieten oder inserieren.`}
        image="https://images.unsplash.com/photo-1431068799455-80bae0caf685?w=1600&q=90"
        imagePosition="center 50%"
        overlay="left"
        height="sm"
        cta={{ label: "Inserat erstellen", href: "/inserat" }}
        ctaSecondary={{ label: "Alles durchsuchen", href: "/props" }}
      />

      {/* Kategorien */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-text-primary">Kategorien</h2>
          <p className="text-sm text-text-muted">9 Kategorien{propCount + vehicleCount > 0 ? ` · ${(propCount + vehicleCount).toLocaleString()} Artikel` : ""}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {kategorien.map(({ icon: Icon, label, desc, href, count, image, iconBg, iconColor, glow, accent, featured }) => (
            <Link
              key={href}
              href={href}
              className={`card-hover group relative rounded-xl border overflow-hidden block ${
                featured ? "border-gold/25" : "border-border"
              }`}
            >
              <div className="absolute inset-0">
                <Image src={image} alt="" fill className="object-cover opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500" sizes="(max-width:640px) 50vw,20vw" />
                <div className={`absolute inset-0 bg-gradient-to-br ${accent} to-transparent opacity-60`} />
                <div className="absolute inset-0 bg-bg-elevated/88" />
              </div>

              <div className="relative z-10 p-4">
                {featured && (
                  <div className="absolute top-3 right-3">
                    <span className="px-1.5 py-0.5 bg-gold/90 text-bg-primary text-[9px] font-bold rounded uppercase tracking-widest">
                      NEU
                    </span>
                  </div>
                )}
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 transition-all ${iconBg} ${glow} group-hover:scale-110`}>
                  <Icon size={14} className={iconColor} />
                </div>
                <div className="font-mono text-[10px] text-text-muted mb-0.5">{count}</div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">{label}</h3>
                <p className="text-[11px] text-text-muted leading-relaxed hidden sm:block line-clamp-2">{desc}</p>
                <div className={`flex items-center gap-1 text-[10px] opacity-0 group-hover:opacity-100 transition-all font-medium mt-2 ${iconColor}`}>
                  Ansehen <ArrowRight size={9} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Ausgewählte Artikel */}
      <div className="bg-bg-secondary border-y border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Sofort buchbar</p>
              <h2 className="font-display text-2xl font-bold text-text-primary">Ausgewählte Artikel</h2>
            </div>
            <Link href="/props" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
              Alle Artikel <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {liveItems.map((item) => (
              <Link key={item.id} href={item.href} className="card-hover group rounded-xl border border-border bg-bg-elevated overflow-hidden block">
                <div className="relative aspect-square overflow-hidden">
                  <Image src={item.image} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width:640px) 50vw,25vw" />
                </div>
                <div className="p-4">
                  <p className="text-xs text-text-muted mb-1">{item.category}</p>
                  <h3 className="font-semibold text-text-primary text-sm mb-1 truncate">{item.title}</h3>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-text-muted">{item.condition}</span>
                    <span className="text-sm font-semibold text-gold">{item.dailyRate.toLocaleString()} € <span className="text-xs font-normal text-text-muted">/Tag</span></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Custom CTA */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative rounded-2xl border border-gold/20 bg-gold-subtle overflow-hidden p-8 sm:p-12 text-center">
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=1200&q=30')", backgroundSize: "cover", backgroundPosition: "center" }} />
          <div className="relative">
            <Sparkles size={32} className="text-gold mx-auto mb-4" />
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">
              Brauchst du etwas Einzigartiges?
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto mb-6 leading-relaxed">
              Unser Netzwerk aus Meisterhandwerkern und Spezialisten fertigt jede Requisite nach deinen
              genauen Vorgaben — produktionsfertig und in höchster Qualität.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/marketplace/commission"
                className="px-7 py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Auftrag ausschreiben
              </Link>
              <Link
                href="/marketplace/commission"
                className="px-7 py-3.5 border border-border text-text-secondary font-semibold rounded-xl hover:border-gold hover:text-gold transition-all flex items-center justify-center gap-2"
              >
                Hersteller durchsuchen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
