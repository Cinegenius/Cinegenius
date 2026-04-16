"use client";

import { useState, useEffect, useRef } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import {
  Menu, X, Film, Sun, Moon, ChevronDown,
  Car, Shirt, Wrench, Clapperboard, Sparkles, Zap,
  Camera, Mic, Drama, Lightbulb, User, Users, Layers, Briefcase,
  LayoutDashboard, Pencil, Eye, LogOut, MessageSquare, Bell,
  Home, Building2, TreePine, Coffee, Monitor,
  Smartphone, ImageIcon, Video, Aperture, MapPin, ShoppingBag,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import NotificationCenter from "@/components/NotificationCenter";
import GlobalSearch from "@/components/GlobalSearch";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type NavItem = { icon: React.ElementType; label: string; desc: string; href: string; iconBg: string; iconColor: string };

const crewGroups: { heading: string; platform?: string; items: NavItem[] }[] = [
  {
    heading: "🎬 Film — Talent",
    platform: "film",
    items: [
      { icon: Drama,     label: "Schauspieler", desc: "Haupt- & Nebenrollen",    href: "/creators?kategorie=vor-der-kamera", iconBg: "bg-rose-500/10 border-rose-500/20",   iconColor: "text-rose-400" },
      { icon: Users,     label: "Statisten",    desc: "Background & Komparsen",  href: "/creators?kategorie=statisten",    iconBg: "bg-sky-500/10 border-sky-500/20",     iconColor: "text-sky-400" },
      { icon: User,      label: "Models",       desc: "Fashion, Print & Video",  href: "/creators?kategorie=models",       iconBg: "bg-pink-500/10 border-pink-500/20",   iconColor: "text-pink-400" },
    ],
  },
  {
    heading: "Film — Regie & Technik",
    platform: "film",
    items: [
      { icon: Clapperboard, label: "Regie",      desc: "Director, AD, Continuity",     href: "/creators?kategorie=regie",      iconBg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400" },
      { icon: Camera,    label: "Kamera",     desc: "DP, Kameramann, AC",          href: "/creators?kategorie=kamera",     iconBg: "bg-blue-500/10 border-blue-500/20",     iconColor: "text-blue-400" },
      { icon: Lightbulb, label: "Licht",      desc: "Gaffer, Best Boy",             href: "/creators?kategorie=licht",      iconBg: "bg-amber-500/10 border-amber-500/20",   iconColor: "text-amber-400" },
      { icon: Mic,       label: "Ton",        desc: "Mixer, Boom, Designer",        href: "/creators?kategorie=ton",        iconBg: "bg-teal-500/10 border-teal-500/20",     iconColor: "text-teal-400" },
      { icon: Briefcase, label: "Produktion", desc: "Producer, Koordination",       href: "/creators?kategorie=produktion", iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400" },
      { icon: Monitor,   label: "Post",       desc: "Editor, Colorist, VFX",        href: "/creators?kategorie=post",       iconBg: "bg-blue-500/10 border-blue-500/20",     iconColor: "text-blue-400" },
    ],
  },
  {
    heading: "📱 Social Media",
    platform: "social",
    items: [
      { icon: Smartphone, label: "Content Creator",    desc: "Creator, Influencer, Manager",  href: "/creators?kategorie=content-creation", iconBg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400" },
      { icon: Video,      label: "Social Videograf",   desc: "Reels, TikTok, Shortform",      href: "/creators?kategorie=social-video",     iconBg: "bg-fuchsia-500/10 border-fuchsia-500/20", iconColor: "text-fuchsia-400" },
    ],
  },
  {
    heading: "📷 Fotografie",
    platform: "photo",
    items: [
      { icon: Aperture,   label: "Fotograf/in",        desc: "Mode, Produkt, Event, Portrait", href: "/creators?kategorie=fotografie",      iconBg: "bg-cyan-500/10 border-cyan-500/20",     iconColor: "text-cyan-400" },
      { icon: ImageIcon,  label: "Foto-Postproduktion",desc: "Retouche, Bildbearbeitung",       href: "/creators?kategorie=foto-post",       iconBg: "bg-lime-500/10 border-lime-500/20",     iconColor: "text-lime-400" },
    ],
  },
];

const crewItems = crewGroups.flatMap((g) => g.items);

const marketGroups: { heading: string; items: NavItem[] }[] = [
  {
    heading: "🎬 Film Equipment",
    items: [
      { icon: Clapperboard, label: "Kamera",     desc: "Kameras, Objektive, Rigs",  href: "/props?cat=kamera",  iconBg: "bg-sky-500/10 border-sky-500/20",     iconColor: "text-sky-400" },
      { icon: Lightbulb,    label: "Licht",      desc: "LEDs, HMI, Scheinwerfer",   href: "/props?cat=licht",   iconBg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-400" },
      { icon: Mic,          label: "Ton",        desc: "Mikrofone, Wireless-Sets",  href: "/props?cat=ton",     iconBg: "bg-teal-500/10 border-teal-500/20",   iconColor: "text-teal-400" },
      { icon: Wrench,       label: "Rigging",    desc: "Kran, Dolly, Track",        href: "/props?cat=rigging", iconBg: "bg-cyan-500/10 border-cyan-500/20",   iconColor: "text-cyan-400" },
    ],
  },
  {
    heading: "Ausstattung & Fahrzeuge",
    items: [
      { icon: Shirt,    label: "Kostüme",    desc: "Alle Epochen & Stile",      href: "/props?cat=kostueme",     iconBg: "bg-rose-500/10 border-rose-500/20",     iconColor: "text-rose-400" },
      { icon: Layers,   label: "Requisiten", desc: "Set-Dressing, Möbel, Props", href: "/props",                  iconBg: "bg-violet-500/10 border-violet-500/20", iconColor: "text-violet-400" },
      { icon: Car,      label: "Fahrzeuge",  desc: "Classic Cars & Stuntautos",  href: "/vehicles",               iconBg: "bg-orange-500/10 border-orange-500/20", iconColor: "text-orange-400" },
      { icon: Zap,      label: "SFX",        desc: "Pyro, Atmosphäre, Effekte",  href: "/props?cat=sfx",          iconBg: "bg-yellow-500/10 border-yellow-500/20", iconColor: "text-yellow-400" },
    ],
  },
  {
    heading: "📷 Foto Equipment",
    items: [
      { icon: Aperture,  label: "Fotoequipment", desc: "Kameras, Objektive, Blitz",   href: "/props?cat=fotoequipment", iconBg: "bg-cyan-500/10 border-cyan-500/20",   iconColor: "text-cyan-400" },
      { icon: ImageIcon, label: "Backdrops",     desc: "Hintergründe & Papierrollen", href: "/props?cat=backdrops",     iconBg: "bg-lime-500/10 border-lime-500/20",   iconColor: "text-lime-400" },
    ],
  },
  {
    heading: "📱 Creator Sets",
    items: [
      { icon: Smartphone, label: "Content Sets",      desc: "Creator-Setups, Ringe, Stative",  href: "/props?cat=content-sets",  iconBg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400" },
      { icon: Sparkles,   label: "Custom",            desc: "Maßanfertigungen",                 href: "/marketplace/commission",  iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400" },
    ],
  },
];

const marketItems = marketGroups.flatMap((g) => g.items);

const locationGroups: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Räume & Gebäude",
    items: [
      { icon: Home,      label: "Wohnen",        desc: "Apartments, Häuser, Lofts",      href: "/locations?type=Wohnen",        iconBg: "bg-sky-500/10 border-sky-500/20",     iconColor: "text-sky-400" },
      { icon: Building2, label: "Villa",          desc: "Herrenhäuser & Luxusanwesen",    href: "/locations?type=Villa",          iconBg: "bg-violet-500/10 border-violet-500/20", iconColor: "text-violet-400" },
      { icon: Briefcase, label: "Büro",           desc: "Büros, Co-Working, Konferenz",   href: "/locations?type=Büro",           iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400" },
      { icon: Clapperboard, label: "Filmstudio",   desc: "Filmstudios, Greenscreen",       href: "/locations?type=Studio",        iconBg: "bg-gold/10 border-gold/20",           iconColor: "text-gold" },
      { icon: Aperture,     label: "Fotostudio",  desc: "Fotostudios, Daylight, Zykloren", href: "/locations?type=Fotostudio",    iconBg: "bg-cyan-500/10 border-cyan-500/20",   iconColor: "text-cyan-400" },
    ],
  },
  {
    heading: "Außen & Besonderes",
    items: [
      { icon: Wrench,    label: "Industrie",      desc: "Hallen, Fabriken, Werkstätten",  href: "/locations?type=Industrie",     iconBg: "bg-slate-500/10 border-slate-500/20", iconColor: "text-slate-400" },
      { icon: TreePine,  label: "Natur",          desc: "Wälder, Felder, Küste",          href: "/locations?type=Natur",         iconBg: "bg-green-500/10 border-green-500/20", iconColor: "text-green-400" },
      { icon: Coffee,    label: "Gastronomie",    desc: "Restaurants, Bars, Cafés",       href: "/locations?type=Gastronomie",   iconBg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-400" },
      { icon: Sparkles,  label: "Speziallocation",desc: "Historisch, Kirche, Bahnhof",    href: "/locations?type=Speziallocation", iconBg: "bg-rose-500/10 border-rose-500/20", iconColor: "text-rose-400" },
    ],
  },
];

const locationItems = locationGroups.flatMap((g) => g.items);

const jobGroups: { heading: string; items: NavItem[] }[] = [
  {
    heading: "🎬 Film — Kreativ",
    items: [
      { icon: Drama,        label: "Vor der Kamera", desc: "Schauspieler, Stunt, Sprecher",  href: "/jobs?role=Vor+der+Kamera",   iconBg: "bg-rose-500/10 border-rose-500/20",     iconColor: "text-rose-400" },
      { icon: Clapperboard, label: "Regie",           desc: "Director, AD, Continuity",       href: "/jobs?role=Regie",            iconBg: "bg-violet-500/10 border-violet-500/20", iconColor: "text-violet-400" },
      { icon: Camera,       label: "Kamera",          desc: "DoP, Kameramann, AC",             href: "/jobs?role=Kamera",           iconBg: "bg-sky-500/10 border-sky-500/20",       iconColor: "text-sky-400" },
      { icon: Lightbulb,    label: "Licht & Ton",     desc: "Gaffer, Tonmeister, Boom",        href: "/jobs?role=Licht",            iconBg: "bg-amber-500/10 border-amber-500/20",   iconColor: "text-amber-400" },
      { icon: Briefcase,    label: "Produktion",      desc: "Producer, PA, Location",          href: "/jobs?role=Produktion",       iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400" },
      { icon: Monitor,      label: "Post",            desc: "Editor, Colorist, VFX",           href: "/jobs?role=Postproduktion",   iconBg: "bg-blue-500/10 border-blue-500/20",     iconColor: "text-blue-400" },
    ],
  },
  {
    heading: "📱 Social Media Jobs",
    items: [
      { icon: Smartphone, label: "Content Creation", desc: "Creator, Influencer, Manager",    href: "/jobs?role=Content+Creation", iconBg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400" },
      { icon: Video,      label: "Social Video",     desc: "Reels, TikTok, UGC",              href: "/jobs?role=Social+Video",     iconBg: "bg-fuchsia-500/10 border-fuchsia-500/20", iconColor: "text-fuchsia-400" },
    ],
  },
  {
    heading: "📷 Foto Jobs",
    items: [
      { icon: Aperture,   label: "Fotografie",       desc: "Mode, Produkt, Event, Portrait",  href: "/jobs?role=Fotografie",       iconBg: "bg-cyan-500/10 border-cyan-500/20",     iconColor: "text-cyan-400" },
      { icon: ImageIcon,  label: "Foto-Post",        desc: "Retouche, Bildbearbeitung",        href: "/jobs?role=Foto-Post",        iconBg: "bg-lime-500/10 border-lime-500/20",     iconColor: "text-lime-400" },
    ],
  },
];

const jobItems = jobGroups.flatMap((g) => g.items);

const desktopNavLinks: { href: string; label: string }[] = [
  { href: "/locations", label: "Drehorte"   },
  { href: "/creators",  label: "Crew"       },
  { href: "/props",     label: "Marktplatz" },
  { href: "/jobs",      label: "Jobs"       },
  { href: "/companies", label: "Firmen"     },
  { href: "/projects",  label: "Projekte"   },
];


export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeAll = () => { setUserMenuOpen(false); };

  useEffect(() => { closeAll(); setOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setProfileDisplayName("");
      setProfileAvatarUrl("");
      setUnreadMessages(0);
      return;
    }
    setProfileDisplayName("");
    setProfileAvatarUrl("");
    fetch("/api/profile")
      .then(r => r.json())
      .then(({ profile }) => {
        if (profile?.display_name) setProfileDisplayName(profile.display_name);
        if (profile?.avatar_url)   setProfileAvatarUrl(profile.avatar_url);
      })
      .catch(() => {});
    // Unread count einmalig laden
    fetch("/api/unread-count")
      .then(r => r.json())
      .then(({ count }) => setUnreadMessages(count ?? 0))
      .catch(() => {});

    // Realtime: Badge neu laden wenn neue Nachricht von jemand anderem ankommt
    const currentUserId = user?.id;
    if (!currentUserId) return;
    const channel = supabase
      .channel(`unread-nav:${currentUserId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        // Nur wenn die Nachricht nicht von mir selbst ist
        if (payload.new?.sender_id !== currentUserId) {
          fetch("/api/unread-count")
            .then(r => r.json())
            .then(({ count }) => setUnreadMessages(count ?? 0))
            .catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSignedIn]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href.split("?")[0] + "/");
  const isCrewActive = isActive("/creators");
  const isMarketActive = isActive("/marketplace") || isActive("/props") || isActive("/vehicles");
  const isLocationsActive = isActive("/locations");
  const isJobsActive = isActive("/jobs");

  // When not scrolled (over hero), use white text for contrast against dark image overlay
  const navBase   = scrolled ? "text-text-secondary hover:text-gold" : "text-white/80 hover:text-white";
  const navActive = scrolled ? "text-gold" : "text-white";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-nav border-b border-border" : "bg-black/30 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {desktopNavLinks.map(({ href, label }) => {
                const basePath = href.split("?")[0] ?? href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-2 text-sm font-medium transition-colors uppercase tracking-widest rounded-md ${isActive(basePath) ? navActive : navBase}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-2">
              <GlobalSearch />
              <button
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
                aria-label="Design wechseln"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <NotificationCenter />
              {isLoaded && !isSignedIn && (
                <>
                  <Link
                    href="/sign-in"
                    className="px-4 py-2 text-sm font-semibold border border-border text-text-secondary hover:border-gold hover:text-gold rounded-md transition-all"
                  >
                    Anmelden
                  </Link>
                  <Link
                    href="/sign-up"
                    className="px-4 py-2 text-sm font-semibold bg-gold text-bg-primary rounded-md hover:bg-gold-light transition-colors"
                  >
                    Kostenlos starten
                  </Link>
                </>
              )}
              {isLoaded && isSignedIn && (() => {
                const avatarSrc = profileAvatarUrl || user?.imageUrl || "";
                const displayName = profileDisplayName || user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "";
                const email = user?.primaryEmailAddress?.emailAddress ?? "";
                const initial = displayName[0]?.toUpperCase() ?? "?";
                return (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(v => !v)}
                      className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-border hover:border-gold/50 hover:bg-bg-elevated transition-all group"
                    >
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="" className="w-7 h-7 rounded-full object-cover border border-border" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
                          <span className="text-gold text-xs font-bold">{initial}</span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors max-w-[100px] truncate hidden xl:block">
                        {displayName}
                      </span>
                      <ChevronDown size={12} className={`text-text-muted transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-56 bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50">
                        {/* Identity */}
                        <div className="px-4 py-3.5 border-b border-border flex items-center gap-3">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt="" className="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                              <span className="text-gold font-bold">{initial}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate leading-tight">{displayName}</p>
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{email}</p>
                          </div>
                        </div>

                        {/* Links */}
                        <div className="py-1.5">
                          <Link
                            href="/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <LayoutDashboard size={15} className="text-text-muted shrink-0" /> Dashboard
                          </Link>
                          <Link
                            href="/messages"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <MessageSquare size={15} className="text-text-muted shrink-0" />
                            <span>Nachrichten</span>
                            {unreadMessages > 0 && (
                              <span className="ml-auto min-w-[18px] h-4.5 bg-crimson text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {unreadMessages > 9 ? "9+" : unreadMessages}
                              </span>
                            )}
                          </Link>
                          <Link
                            href="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <Pencil size={15} className="text-text-muted shrink-0" /> Profil bearbeiten
                          </Link>
                          <Link
                            href={user?.id ? `/profile/${user.id}` : "/profile"}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <Eye size={15} className="text-text-muted shrink-0" /> Profil ansehen
                          </Link>
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-border py-1.5">
                          <button
                            onClick={() => { setUserMenuOpen(false); signOut(); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-red-400 hover:bg-red-500/5 transition-colors"
                          >
                            <LogOut size={15} className="shrink-0" /> Abmelden
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Mobile: notifications + theme + menu */}
            <div className="lg:hidden flex items-center gap-1">
              {isLoaded && isSignedIn && (
                <NotificationCenter />
              )}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-md text-text-muted hover:text-gold transition-colors"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-gold transition-colors"
                onClick={() => setOpen(!open)}
                aria-label="Menü öffnen"
              >
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Mobile panel */}
      <div
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-80 bg-bg-secondary border-l border-border shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <Logo onClick={() => setOpen(false)} />
          <button onClick={() => setOpen(false)} className="text-text-muted hover:text-gold transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="px-4 py-5 overflow-y-auto h-[calc(100%-4rem)] flex flex-col gap-4">

          {/* Mobile search */}
          <GlobalSearch />

          {/* Main nav links */}
          <div className="space-y-1">
            {[
              { href: "/locations", label: "Drehorte",   icon: MapPin },
              { href: "/creators",  label: "Crew",       icon: Users },
              { href: "/props",     label: "Marktplatz", icon: ShoppingBag },
              { href: "/jobs",      label: "Jobs",       icon: Briefcase },
              { href: "/companies", label: "Firmen",     icon: Building2 },
              { href: "/projects",  label: "Projekte",   icon: Film },
              { href: "/messages",  label: "Nachrichten", icon: MessageSquare },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${
                  isActive(href)
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                }`}
              >
                <Icon size={18} className={isActive(href) ? "text-gold" : "text-text-muted"} />
                <span>{label}</span>
                {href === "/messages" && unreadMessages > 0 ? (
                  <span className="ml-auto min-w-[20px] h-5 bg-crimson text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                ) : (
                  <ChevronDown size={14} className="ml-auto -rotate-90 text-text-muted/50" />
                )}
              </Link>
            ))}
          </div>

          {/* Mein Bereich — nur wenn eingeloggt */}
          {isLoaded && isSignedIn && (
            <div className="space-y-1 border-t border-border pt-4">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted px-4 mb-2">Mein Bereich</p>
              <Link href="/dashboard" onClick={() => setOpen(false)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${isActive("/dashboard") ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}>
                <LayoutDashboard size={18} className={isActive("/dashboard") ? "text-gold" : "text-text-muted"} />
                Dashboard
              </Link>
              <Link href="/profile" onClick={() => setOpen(false)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${isActive("/profile") ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}>
                <Pencil size={18} className={isActive("/profile") ? "text-gold" : "text-text-muted"} />
                Profil bearbeiten
              </Link>
              <Link href="/notifications" onClick={() => setOpen(false)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${isActive("/notifications") ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}>
                <Bell size={18} className={isActive("/notifications") ? "text-gold" : "text-text-muted"} />
                Benachrichtigungen
              </Link>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-border space-y-2">
            {isLoaded && !isSignedIn && (
              <>
                <Link href="/sign-in" onClick={() => setOpen(false)} className="block w-full py-2.5 px-3 text-sm text-center font-medium border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-all">
                  Anmelden
                </Link>
                <Link href="/sign-up" onClick={() => setOpen(false)} className="block w-full py-2.5 px-3 text-sm text-center font-semibold bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors">
                  Kostenlos starten
                </Link>
              </>
            )}
            {isLoaded && isSignedIn && (
              <>
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:text-red-400 rounded-lg transition-colors"
                >
                  <LogOut size={14} /> Abmelden
                </button>
              </>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
