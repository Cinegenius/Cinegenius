"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2, MapPin, Globe, Mail, Phone, CheckCircle,
  Package, Briefcase, Car, Home, Clapperboard, X,
  Pencil, Users, UserPlus, Clock, Check,
  UserMinus, Crown, ChevronRight, ExternalLink,
  Calendar, Scale, Globe2, Quote,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { COMPANY_CATEGORY_BY_ID } from "@/lib/companyCategories";
import {
  EQUIPMENT_CATEGORY_BY_ID, CONDITION_LABELS, CONDITION_COLORS, SERVICE_TYPE_BY_ID,
} from "@/lib/equipment-categories";
import Lightbox from "@/components/Lightbox";

type Listing = {
  id: string;
  title: string;
  type: string;
  category: string | null;
  price: number;
  city: string;
  image_url: string | null;
  created_at: string;
};

type MemberProfile = {
  display_name: string;
  avatar_url: string | null;
  slug: string | null;
  role: string | null;
} | null;

type Member = {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  status: string;
  created_at: string;
  profile: MemberProfile;
};

type ServiceItem = {
  id: string; type: string; title: string; description: string | null;
  use_cases: string[]; price_on_request: boolean; price_note: string | null;
};

type EquipmentItem = {
  id: string; category: string; subcategory: string | null; name: string;
  brand: string | null; model: string | null; condition: string; available: boolean;
  price_day: number | null; price_week: number | null; price_on_request: boolean;
  pickup_available: boolean; delivery_available: boolean; insured: boolean; quantity: number;
};

type Company = {
  id: string;
  slug: string;
  owner_user_id: string;
  name: string;
  logo_url: string | null;
  description: string;
  bio_short: string | null;
  tagline: string | null;
  usp: string | null;
  founded_year: number | null;
  legal_form: string | null;
  hq_address: string | null;
  countries: string[];
  industry_focus: string[];
  city: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  categories: string[];
  services: string[];
  portfolio_images: string[];
  social_links: Record<string, string> | null;
  verified: boolean;
  created_at: string;
};

const listingTypeIcons: Record<string, React.ElementType> = {
  job: Briefcase, prop: Package, vehicle: Car, location: Home, service: Clapperboard,
};
const listingTypeLabel: Record<string, string> = {
  job: "Job", prop: "Requisite", vehicle: "Fahrzeug", location: "Location", service: "Service",
};

const INDUSTRY_COLORS: Record<string, string> = {
  "Film":            "bg-blue-500/10 text-blue-400 border-blue-500/25",
  "Werbung":         "bg-purple-500/10 text-purple-400 border-purple-500/25",
  "Serie":           "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
  "Musikvideo":      "bg-pink-500/10 text-pink-400 border-pink-500/25",
  "Social Content":  "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  "Dokumentarfilm":  "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "Event":           "bg-orange-500/10 text-orange-400 border-orange-500/25",
  "Theater":         "bg-rose-500/10 text-rose-400 border-rose-500/25",
  "Animation":       "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
  "VFX / Post":      "bg-violet-500/10 text-violet-400 border-violet-500/25",
  "Fotografie":      "bg-teal-500/10 text-teal-400 border-teal-500/25",
  "Corporate Video": "bg-slate-500/10 text-slate-300 border-slate-500/25",
};

export default function CompanyDetail({
  company, listings, members, services, equipment, myMembership, currentUserId,
}: {
  company: Company;
  listings: Listing[];
  members: Member[];
  services: ServiceItem[];
  equipment: EquipmentItem[];
  myMembership: { id: string; status: string } | null;
  currentUserId: string | null;
}) {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const isOwner = user?.id === company.owner_user_id;
  const cats = company.categories.map((id) => COMPANY_CATEGORY_BY_ID[id]).filter(Boolean);

  const [localMembers, setLocalMembers] = useState<Member[]>(members);
  const [localMembership, setLocalMembership] = useState(myMembership);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [showAllTeam, setShowAllTeam] = useState(false);

  const acceptedMembers = localMembers
    .filter((m) => m.status === "accepted")
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
  const pendingMembers = localMembers.filter((m) => m.status === "pending");

  async function handleJoinRequest() {
    setJoining(true); setJoinError("");
    try {
      const res = await fetch("/api/company-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company.id }),
      });
      const { data, error } = await res.json();
      if (error) throw new Error(error);
      setLocalMembership({ id: data.id, status: data.status });
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!localMembership) return;
    const res = await fetch(`/api/company-members?id=${localMembership.id}`, { method: "DELETE" });
    if (res.ok) { setLocalMembership(null); setLocalMembers((p) => p.filter((m) => m.id !== localMembership.id)); }
  }

  async function handleAccept(id: string) {
    const res = await fetch("/api/company-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "accepted" }),
    });
    if (res.ok) setLocalMembers((p) => p.map((m) => m.id === id ? { ...m, status: "accepted" } : m));
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/company-members?id=${id}`, { method: "DELETE" });
    if (res.ok) setLocalMembers((p) => p.filter((m) => m.id !== id));
  }

  return (
    <div className="pt-16 min-h-screen bg-bg-primary text-text-primary">

      {isWelcome && !welcomeDismissed && (
        <div className="bg-gold/10 border-b border-gold/20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gold flex items-center gap-2"><CheckCircle size={14} /> Firmenprofil erstellt!</span>
            <button onClick={() => setWelcomeDismissed(true)}><X size={14} className="text-gold/50 hover:text-gold" /></button>
          </div>
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-start gap-5">

            {/* Logo */}
            <div className="w-48 h-48 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
              {company.logo_url
                ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <Building2 size={56} className="text-text-muted" />
              }
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + badges */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-text-primary leading-tight">
                  {company.name}
                </h1>
                {company.verified && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gold/10 border border-gold/20 rounded-full text-[10px] text-gold font-semibold">
                    <CheckCircle size={9} /> Verifiziert
                  </span>
                )}
              </div>

              {/* Tagline */}
              {company.tagline && (
                <p className="text-sm text-text-muted italic mb-2">{company.tagline}</p>
              )}

              {/* Categories */}
              {cats.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {cats.map((cat) => (
                    <span key={cat.id} className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${cat.bg} ${cat.color}`}>
                      {cat.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Industry focus chips */}
              {company.industry_focus?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {company.industry_focus.map((f) => (
                    <span key={f} className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${INDUSTRY_COLORS[f] ?? "bg-bg-elevated text-text-muted border-border"}`}>
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1"><MapPin size={11} />{company.city}</span>
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-gold transition-colors">
                    <Globe size={11} />
                    {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    <ExternalLink size={9} />
                  </a>
                )}
                {acceptedMembers.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {acceptedMembers.length} {acceptedMembers.length === 1 ? "Person" : "Personen"}
                  </span>
                )}
              </div>
            </div>

            {/* Edit */}
            {isOwner && (
              <Link href="/company-setup"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-text-muted hover:text-gold hover:border-gold/40 transition-colors shrink-0">
                <Pencil size={12} /> Bearbeiten
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">

          {/* ── LEFT ──────────────────────────────────────────────────── */}
          <div className="space-y-10 min-w-0">

            {/* About */}
            {(company.bio_short || company.description || company.usp) && (
              <section>
                <SectionLabel>Über das Unternehmen</SectionLabel>
                <div className="space-y-4">
                  {company.bio_short && (
                    <p className="text-sm text-text-primary leading-relaxed font-medium">
                      {company.bio_short}
                    </p>
                  )}
                  {company.usp && (
                    <div className="flex gap-3 p-4 bg-gold/5 border-l-2 border-gold rounded-r-xl">
                      <Quote size={16} className="text-gold shrink-0 mt-0.5" />
                      <p className="text-sm text-text-secondary leading-relaxed italic">{company.usp}</p>
                    </div>
                  )}
                  {company.description && (
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {company.description}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Team — project list style */}
            {(acceptedMembers.length > 0 || isOwner) && (
              <section>
                <SectionLabel>Team ({acceptedMembers.length})</SectionLabel>
                <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                  {/* Header row */}
                  <div className="grid grid-cols-[2fr_1fr_90px] gap-4 px-5 py-3 border-b border-border bg-bg-elevated">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Name</span>
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Position</span>
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Rolle</span>
                  </div>
                  {/* Member rows */}
                  <div className="divide-y divide-border">
                    {(showAllTeam ? acceptedMembers : acceptedMembers.slice(0, 10)).map((m) => {
                      const slug = m.profile?.slug ?? m.user_id;
                      const name = m.profile?.display_name ?? "Unbekannt";
                      const position = m.title ?? m.profile?.role ?? "—";
                      const isCompanyOwner = m.role === "owner";
                      return (
                        <Link key={m.id} href={`/profile/${slug}`}
                          className="grid grid-cols-[2fr_1fr_90px] gap-4 px-5 py-3.5 hover:bg-bg-elevated transition-colors group items-center">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <Avatar member={m} size={32} />
                              {isCompanyOwner && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-bg-primary border border-border flex items-center justify-center">
                                  <Crown size={6} className="text-gold" />
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{name}</span>
                          </div>
                          <span className="text-sm text-text-secondary truncate">{position}</span>
                          <div>
                            {isCompanyOwner
                              ? <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-gold/10 text-gold border-gold/25">Inhaber</span>
                              : <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-bg-elevated text-text-muted border-border">Mitglied</span>
                            }
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {/* Show more */}
                  {acceptedMembers.length > 10 && (
                    <button
                      onClick={() => setShowAllTeam((v) => !v)}
                      className="w-full px-5 py-3 border-t border-border bg-bg-secondary hover:bg-bg-elevated text-xs text-text-muted hover:text-gold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Users size={11} />
                      {showAllTeam ? "Weniger anzeigen" : `Alle ${acceptedMembers.length} Mitglieder anzeigen`}
                    </button>
                  )}
                </div>

                {/* Pending requests — owner only */}
                {isOwner && pendingMembers.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-amber-400 font-semibold flex items-center gap-1">
                      <Clock size={10} /> Beitrittsanfragen ({pendingMembers.length})
                    </p>
                    {pendingMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-bg-secondary border border-border rounded-xl">
                        <Avatar member={m} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{m.profile?.display_name ?? "Unbekannt"}</p>
                          {m.profile?.role && <p className="text-[11px] text-text-muted truncate">{m.profile.role}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleAccept(m.id)} title="Annehmen"
                            className="p-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success transition-colors">
                            <Check size={12} />
                          </button>
                          <button onClick={() => handleReject(m.id)} title="Ablehnen"
                            className="p-1.5 rounded-lg hover:bg-crimson/10 text-text-muted hover:text-crimson-light transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Portfolio — prominent grid */}
            {company.portfolio_images.length > 0 && (
              <section>
                <SectionLabel>Portfolio</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {company.portfolio_images.slice(0, 9).map((url, i) => (
                    <button key={i} onClick={() => setLightboxIdx(i)}
                      className="aspect-square rounded-xl overflow-hidden bg-bg-elevated hover:opacity-85 transition-opacity relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {i === 8 && company.portfolio_images.length > 9 && (
                        <div className="absolute inset-0 bg-bg-primary/60 flex items-center justify-center">
                          <span className="text-sm font-bold text-text-primary">+{company.portfolio_images.length - 9}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {lightboxIdx !== null && (
                  <Lightbox
                    images={company.portfolio_images}
                    activeIndex={lightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                    onPrev={() => setLightboxIdx((i) => i !== null ? (i - 1 + company.portfolio_images.length) % company.portfolio_images.length : 0)}
                    onNext={() => setLightboxIdx((i) => i !== null ? (i + 1) % company.portfolio_images.length : 0)}
                  />
                )}
              </section>
            )}

            {/* Services */}
            {services.length > 0 && (
              <section>
                <SectionLabel>Services ({services.length})</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => (
                    <div key={svc.id} className="p-4 bg-bg-secondary border border-border rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-text-muted px-2 py-0.5 bg-bg-elevated border border-border rounded-full">
                          {SERVICE_TYPE_BY_ID[svc.type]?.label ?? svc.type}
                        </span>
                        {!svc.price_on_request && svc.price_note && (
                          <span className="text-[10px] text-gold">{svc.price_note}</span>
                        )}
                        {svc.price_on_request && (
                          <span className="text-[10px] text-text-muted">Preis auf Anfrage</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-text-primary mb-1">{svc.title}</p>
                      {svc.description && (
                        <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{svc.description}</p>
                      )}
                      {svc.use_cases?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {svc.use_cases.map((u) => (
                            <span key={u} className="text-[10px] px-2 py-0.5 bg-bg-elevated border border-border rounded-full text-text-muted">{u}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Equipment */}
            {equipment.length > 0 && (
              <section>
                <SectionLabel>Equipment ({equipment.length})</SectionLabel>
                <div className="space-y-2">
                  {equipment.slice(0, 12).map((item) => {
                    const cat = EQUIPMENT_CATEGORY_BY_ID[item.category];
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <span className="text-lg shrink-0">{cat?.emoji ?? "📦"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                            {item.brand && <span className="text-xs text-text-muted">{item.brand}{item.model ? ` ${item.model}` : ""}</span>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CONDITION_COLORS[item.condition]}`}>
                              {CONDITION_LABELS[item.condition]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                            {cat && <span>{cat.label}</span>}
                            {item.subcategory && <span>· {item.subcategory}</span>}
                            {item.quantity > 1 && <span>· {item.quantity}×</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {!item.price_on_request && item.price_day ? (
                            <p className="text-sm font-semibold text-gold">{item.price_day} €<span className="text-text-muted font-normal text-xs">/Tag</span></p>
                          ) : (
                            <p className="text-xs text-text-muted">Auf Anfrage</p>
                          )}
                          <p className={`text-[10px] mt-0.5 ${item.available ? "text-emerald-400" : "text-text-muted"}`}>
                            {item.available ? "Verfügbar" : "Nicht verfügbar"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {equipment.length > 12 && (
                    <p className="text-xs text-text-muted pt-1">+ {equipment.length - 12} weitere — für vollständige Liste anfragen</p>
                  )}
                </div>
              </section>
            )}

            {/* Listings */}
            {listings.length > 0 && (
              <section>
                <SectionLabel>Inserate ({listings.length})</SectionLabel>
                <div className="divide-y divide-border">
                  {listings.map((listing) => {
                    const Icon = listingTypeIcons[listing.type] ?? Package;
                    const href = listing.type === "job" ? `/jobs/${listing.id}` : `/props/${listing.id}`;
                    return (
                      <Link key={listing.id} href={href}
                        className="flex items-center gap-3 py-3 group -mx-1 px-1 rounded-lg hover:bg-bg-secondary/60 transition-colors">
                        {listing.image_url
                          ? <img src={listing.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" /> // eslint-disable-line @next/next/no-img-element
                          : <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0"><Icon size={16} className="text-text-muted" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary group-hover:text-gold transition-colors truncate">{listing.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                            <span>{listingTypeLabel[listing.type] ?? listing.type}</span>
                            <span>·</span>
                            <span>{listing.city}</span>
                            {listing.price > 0 && <><span>·</span><span className="text-gold">{listing.price} €</span></>}
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-text-muted shrink-0 group-hover:text-gold transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

          </div>

          {/* ── RIGHT ─────────────────────────────────────────────────── */}
          <div className="space-y-8">

            {/* Contact */}
            {(company.email || company.website || company.phone) && (
              <section>
                <SectionLabel>Kontakt</SectionLabel>
                <div className="space-y-2">
                  {company.email && (
                    <a href={`mailto:${company.email}`}
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-gold text-bg-primary rounded-lg text-sm font-semibold hover:bg-gold-light transition-colors">
                      <Mail size={13} /> E-Mail schreiben
                    </a>
                  )}
                  {company.phone && (
                    <a href={`tel:${company.phone}`}
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                      <Phone size={13} /> {company.phone}
                    </a>
                  )}
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                      <Globe size={13} /> Website <ExternalLink size={10} className="ml-auto" />
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Social links */}
            {company.social_links && Object.values(company.social_links).some(Boolean) && (
              <section>
                <SectionLabel>Social Media</SectionLabel>
                <div className="space-y-1.5">
                  {(
                    [
                      { key: "instagram", label: "Instagram" },
                      { key: "linkedin",  label: "LinkedIn" },
                      { key: "youtube",   label: "YouTube" },
                      { key: "vimeo",     label: "Vimeo" },
                      { key: "tiktok",    label: "TikTok" },
                      { key: "facebook",  label: "Facebook" },
                    ] as const
                  )
                    .filter(({ key }) => company.social_links?.[key]?.trim())
                    .map(({ key, label }) => (
                      <a
                        key={key}
                        href={company.social_links![key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors group"
                      >
                        <span className="font-medium flex-1">{label}</span>
                        <ExternalLink size={10} className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                </div>
              </section>
            )}

            {/* Join / leave */}
            {currentUserId && !isOwner && (
              <section>
                {!localMembership ? (
                  <>
                    {joinError && <p className="text-xs text-crimson-light mb-1.5">{joinError}</p>}
                    <button onClick={handleJoinRequest} disabled={joining}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm text-text-muted hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50">
                      <UserPlus size={13} /> {joining ? "Wird gesendet…" : "Team beitreten"}
                    </button>
                  </>
                ) : localMembership.status === "pending" ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-amber-400 flex items-center gap-1.5"><Clock size={11} /> Anfrage ausstehend</p>
                    <button onClick={handleLeave} className="text-xs text-text-muted hover:text-crimson-light transition-colors flex items-center gap-1">
                      <UserMinus size={11} /> Zurückziehen
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-success flex items-center gap-1.5"><CheckCircle size={11} /> Du bist Teammitglied</p>
                    <button onClick={handleLeave} className="text-xs text-text-muted hover:text-crimson-light transition-colors flex items-center gap-1">
                      <UserMinus size={11} /> Firma verlassen
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Firmendaten */}
            {(company.founded_year || company.legal_form || company.hq_address || company.countries?.length > 0) && (
              <section>
                <SectionLabel>Firmendaten</SectionLabel>
                <div className="space-y-2 text-xs text-text-secondary">
                  {company.founded_year && (
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-text-muted shrink-0" />
                      <span>Gegründet {company.founded_year}</span>
                    </div>
                  )}
                  {company.legal_form && (
                    <div className="flex items-center gap-2">
                      <Scale size={12} className="text-text-muted shrink-0" />
                      <span>{company.legal_form}</span>
                    </div>
                  )}
                  {company.hq_address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={12} className="text-text-muted shrink-0 mt-0.5" />
                      <span>{company.hq_address}</span>
                    </div>
                  )}
                  {company.countries?.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Globe2 size={12} className="text-text-muted shrink-0 mt-0.5" />
                      <span>{company.countries.join(", ")}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Services keywords */}
            {company.services.length > 0 && (
              <section>
                <SectionLabel>Leistungen</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {company.services.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-bg-secondary border border-border text-xs text-text-secondary rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-3">{children}</p>
  );
}

function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  const name = member.profile?.display_name ?? "?";
  return (
    <div className="rounded-full bg-bg-elevated border border-border overflow-hidden shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, minWidth: size }}>
      {member.profile?.avatar_url
        ? <img src={member.profile.avatar_url} alt={name} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
        : <span className="text-xs font-bold text-text-muted">{name[0]?.toUpperCase()}</span>
      }
    </div>
  );
}

