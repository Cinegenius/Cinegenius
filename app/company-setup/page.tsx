"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Building2, MapPin, Globe, Mail, Phone, FileText, Briefcase,
  Upload, X, ArrowRight, CheckCircle, Loader2, Sparkles,
  ChevronDown, ChevronUp, ImageIcon, Plus, Trash2,
  Users, Check, UserX, Clock, Calendar, Scale, Tag,
  Quote, Globe2,
} from "lucide-react";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import ProfileGuard from "@/components/ProfileGuard";

const MAX_PORTFOLIO = 8;

export default function CompanySetupPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Basic info
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Logo
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Portfolio images
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const portfolioRef = useRef<HTMLInputElement>(null);

  // Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Services (free text tags)
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");

  // Editing existing company
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Extended fields
  const [tagline, setTagline] = useState("");
  const [bioShort, setBioShort] = useState("");
  const [usp, setUsp] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [hqAddress, setHqAddress] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [countryInput, setCountryInput] = useState("");
  const [industryFocus, setIndustryFocus] = useState<string[]>([]);

  // Social links
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  // Owner's own position within the company
  const [ownerTitle, setOwnerTitle] = useState("");

  // Team management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    // Pre-fill email from Clerk
    const primaryEmail = user.primaryEmailAddress?.emailAddress;
    if (primaryEmail) setEmail(primaryEmail);

    // Check if user already has a company
    fetch("/api/companies?mine=true")
      .then((r) => r.json())
      .then(({ data }) => {
        if (data && data.length > 0) {
          const c = data[0];
          setExistingId(c.id);
          setName(c.name ?? "");
          setCity(c.city ?? "");
          setDescription(c.description ?? "");
          setWebsite(c.website ?? "");
          setEmail(c.email ?? primaryEmail ?? "");
          setPhone(c.phone ?? "");
          setLogoUrl(c.logo_url ?? "");
          setLogoPreview(c.logo_url ?? "");
          setSelectedCategories(c.categories ?? []);
          setServices(c.services ?? []);
          setPortfolioImages(c.portfolio_images ?? []);
          setTagline(c.tagline ?? "");
          setBioShort(c.bio_short ?? "");
          setUsp(c.usp ?? "");
          setFoundedYear(c.founded_year ? String(c.founded_year) : "");
          setLegalForm(c.legal_form ?? "");
          setHqAddress(c.hq_address ?? "");
          setCountries(c.countries ?? []);
          setIndustryFocus(c.industry_focus ?? []);
          setSocialLinks(c.social_links ?? {});

          // Load team members (includes owner's own entry)
          setTeamLoading(true);
          fetch(`/api/company-members?company_id=${c.id}`)
            .then((r) => r.json())
            .then(({ data: members }) => {
              if (members) {
                setTeamMembers(members);
                // Pre-fill owner's own title
                const ownerEntry = members.find(
                  (m: { role: string; user_id: string }) => m.role === "owner"
                );
                if (ownerEntry?.title) setOwnerTitle(ownerEntry.title);
              }
            })
            .finally(() => setTeamLoading(false));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isLoaded, user]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error: err } = await res.json();
      if (err) throw new Error(err);
      setLogoUrl(url);
    } catch {
      setError("Logo-Upload fehlgeschlagen.");
      setLogoPreview(logoUrl);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PORTFOLIO - portfolioImages.length;
    const toUpload = files.slice(0, remaining);
    setUploadingPortfolio(true);
    try {
      const urls: string[] = [];
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const { url, error: err } = await res.json();
        if (err) throw new Error(err);
        urls.push(url);
      }
      setPortfolioImages((prev) => [...prev, ...urls]);
    } catch {
      setError("Portfolio-Upload fehlgeschlagen.");
    } finally {
      setUploadingPortfolio(false);
      e.target.value = "";
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const addService = () => {
    const v = serviceInput.trim();
    if (v && !services.includes(v) && services.length < 20) {
      setServices((prev) => [...prev, v]);
      setServiceInput("");
    }
  };

  const handleAcceptMember = async (id: string) => {
    const res = await fetch("/api/company-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "accepted" }),
    });
    if (res.ok) {
      setTeamMembers((prev) => prev.map((m) => m.id === id ? { ...m, status: "accepted" } : m));
    }
  };

  const handleRemoveMember = async (id: string) => {
    const res = await fetch(`/api/company-members?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleUpdateTitle = async (id: string, title: string) => {
    await fetch("/api/company-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Firmenname ist ein Pflichtfeld."); return; }
    if (!city.trim()) { setError("Standort ist ein Pflichtfeld."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existingId,
          name, city, description, website, email, phone,
          logo_url: logoUrl || null,
          categories: selectedCategories,
          services,
          portfolio_images: portfolioImages,
          owner_title: ownerTitle.trim() || null,
          tagline: tagline.trim() || null,
          bio_short: bioShort.trim() || null,
          usp: usp.trim() || null,
          founded_year: foundedYear ? Number(foundedYear) : null,
          legal_form: legalForm || null,
          hq_address: hqAddress.trim() || null,
          countries,
          industry_focus: industryFocus,
          social_links: Object.fromEntries(
            Object.entries(socialLinks).filter(([, v]) => v?.trim())
          ),
        }),
      });
      const { data, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);
      router.replace(`/companies/${data.slug}?welcome=1`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
      setSaving(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="pt-24 min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <ProfileGuard>
      <div className="pt-16 min-h-screen bg-bg-primary">
        <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold/10 border border-gold/20 rounded-full mb-5">
              <Sparkles size={13} className="text-gold" />
              <span className="text-xs text-gold font-semibold uppercase tracking-widest">
                {existingId ? "Firmenprofil bearbeiten" : "Firmenprofil anlegen"}
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">
              {existingId ? "Dein Firmenprofil" : "Dein Unternehmen auf CineGenius"}
            </h1>
            <p className="text-text-secondary max-w-sm mx-auto leading-relaxed text-sm">
              Präsentiere dein Unternehmen der Filmbranche — von Verleih bis Postproduktion.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-border hover:border-gold transition-colors group overflow-hidden bg-bg-secondary"
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1.5">
                    <Building2 size={22} className="text-text-muted group-hover:text-gold transition-colors" />
                    <span className="text-[10px] text-text-muted group-hover:text-gold">Logo</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-bg-primary/70 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-gold" />
                  </div>
                )}
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoPreview(""); setLogoUrl(""); }}
                  className="text-xs text-text-muted hover:text-crimson-light flex items-center gap-1 transition-colors"
                >
                  <X size={11} /> Entfernen
                </button>
              )}
              <p className="text-xs text-text-muted">Firmenlogo hochladen (empfohlen)</p>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            {/* Basic info */}
            <div className="space-y-4">
              <SectionDivider label="Pflichtfelder" />

              <Field label="Firmenname" required>
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <Building2 size={15} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Muster Film GmbH"
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    required
                  />
                  {name && <CheckCircle size={15} className="text-success shrink-0" />}
                </div>
              </Field>

              <Field label="Standort / Hauptsitz" required>
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <MapPin size={15} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Berlin, München, Hamburg..."
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    required
                  />
                  {city && <CheckCircle size={15} className="text-success shrink-0" />}
                </div>
              </Field>
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <SectionDivider label="Kategorien" />
              <p className="text-xs text-text-muted">Welche Dienstleistungen bietet dein Unternehmen an?</p>

              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 bg-gold/5 border border-gold/20 rounded-xl">
                  {selectedCategories.map((id) => {
                    const cat = COMPANY_CATEGORIES.find((c) => c.id === id);
                    if (!cat) return null;
                    return (
                      <span key={id} className={`flex items-center gap-1 px-2.5 py-1 ${cat.bg} text-xs ${cat.color} rounded-full font-medium border`}>
                        {cat.label}
                        <button type="button" onClick={() => toggleCategory(id)} className="hover:opacity-70 ml-0.5">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setCategoriesOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary border border-border rounded-xl hover:border-gold transition-colors text-left"
              >
                <span className="text-sm text-text-secondary">Kategorien auswählen...</span>
                {categoriesOpen ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
              </button>

              {categoriesOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 bg-bg-elevated border border-border rounded-xl">
                  {COMPANY_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all border text-left ${
                          isSelected
                            ? `${cat.bg} ${cat.color} border-current`
                            : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{cat.label}</div>
                          <div className="text-[10px] opacity-70 mt-0.5">{cat.examples}</div>
                        </div>
                        {isSelected && <CheckCircle size={13} className="shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tagline / Claim */}
            <div className="space-y-4">
              <SectionDivider label="Claim & Tagline" />
              <Field label="Tagline / Claim">
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <Tag size={15} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="z.B. Wir bringen deine Geschichte zum Leuchten"
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    maxLength={100}
                  />
                  <span className="text-[10px] text-text-muted shrink-0">{tagline.length}/100</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">Kurzer Satz, der eure Marke auf den Punkt bringt.</p>
              </Field>
            </div>

            {/* Industry focus */}
            <div className="space-y-3">
              <SectionDivider label="Branchenfokus" />
              <p className="text-xs text-text-muted">In welchen Bereichen seid ihr hauptsächlich tätig?</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Film", "Werbung", "Serie", "Musikvideo", "Social Content",
                  "Dokumentarfilm", "Event", "Theater", "Animation", "VFX / Post",
                  "Fotografie", "Corporate Video",
                ].map((focus) => {
                  const active = industryFocus.includes(focus);
                  return (
                    <button
                      key={focus}
                      type="button"
                      onClick={() =>
                        setIndustryFocus((prev) =>
                          active ? prev.filter((f) => f !== focus) : [...prev, focus]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? "bg-gold/15 border-gold/40 text-gold"
                          : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                      }`}
                    >
                      {active && <span className="mr-1">✓</span>}
                      {focus}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Company details */}
            <div className="space-y-4">
              <SectionDivider label="Firmendaten" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Gründungsjahr">
                  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                    <Calendar size={15} className="text-text-muted shrink-0" />
                    <input
                      type="number"
                      value={foundedYear}
                      onChange={(e) => setFoundedYear(e.target.value)}
                      placeholder="2015"
                      min={1900}
                      max={new Date().getFullYear()}
                      className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    />
                  </div>
                </Field>
                <Field label="Rechtsform">
                  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                    <Scale size={15} className="text-text-muted shrink-0" />
                    <select
                      value={legalForm}
                      onChange={(e) => setLegalForm(e.target.value)}
                      className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none appearance-none"
                    >
                      <option value="">— wählen —</option>
                      {["GmbH", "UG (haftungsbeschränkt)", "GbR", "e.K.", "AG", "Einzelunternehmen", "Freiberufler/in", "Sonstiges"].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </Field>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <SectionDivider label="Standort & Reichweite" />
              <Field label="Geschäftsadresse">
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <MapPin size={15} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={hqAddress}
                    onChange={(e) => setHqAddress(e.target.value)}
                    placeholder="Musterstraße 1, 10115 Berlin"
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    maxLength={200}
                  />
                </div>
              </Field>
              <Field label="Tätigkeitsländer">
                <div className="space-y-2">
                  {countries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {countries.map((c) => (
                        <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-bg-elevated border border-border text-xs text-text-secondary rounded-full">
                          {c}
                          <button
                            type="button"
                            onClick={() => setCountries((prev) => prev.filter((x) => x !== c))}
                            className="hover:text-crimson-light ml-0.5"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                    <Globe2 size={15} className="text-text-muted shrink-0" />
                    <input
                      type="text"
                      value={countryInput}
                      onChange={(e) => setCountryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = countryInput.trim();
                          if (v && !countries.includes(v) && countries.length < 15) {
                            setCountries((prev) => [...prev, v]);
                            setCountryInput("");
                          }
                        }
                      }}
                      placeholder="z.B. Deutschland, Österreich, Schweiz..."
                      className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                      maxLength={50}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = countryInput.trim();
                        if (v && !countries.includes(v) && countries.length < 15) {
                          setCountries((prev) => [...prev, v]);
                          setCountryInput("");
                        }
                      }}
                      disabled={!countryInput.trim() || countries.length >= 15}
                      className="text-text-muted hover:text-gold transition-colors disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted">Enter drücken zum Hinzufügen</p>
                </div>
              </Field>
            </div>

            {/* Owner position */}
            <div className="space-y-4">
              <SectionDivider label="Deine Rolle" />
              <Field label="Meine Position / Funktion in der Firma">
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <Briefcase size={15} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={ownerTitle}
                    onChange={(e) => setOwnerTitle(e.target.value)}
                    placeholder="z.B. Geschäftsführer, Produzent, Creative Director..."
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    maxLength={80}
                  />
                  {ownerTitle && <CheckCircle size={15} className="text-success shrink-0" />}
                </div>
                <p className="text-[11px] text-text-muted mt-1">Erscheint auf deinem Profil und im Team-Bereich der Firma.</p>
              </Field>
            </div>

            {/* Description */}
            <div className="space-y-4">
              <SectionDivider label="Über euch" />

              <Field label="Kurzvorstellung">
                <div className="bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors flex items-start gap-2 pt-3">
                  <FileText size={15} className="text-text-muted mt-0.5 shrink-0" />
                  <textarea
                    rows={2}
                    value={bioShort}
                    onChange={(e) => setBioShort(e.target.value)}
                    placeholder="2–3 Sätze: Was macht ihr, für wen, und was macht euch besonders?"
                    className="bg-transparent border-none pb-3 text-sm flex-1 focus:outline-none resize-none"
                    maxLength={160}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1 flex justify-between">
                  <span>Erscheint prominent ganz oben im Profil.</span>
                  <span>{bioShort.length}/160</span>
                </p>
              </Field>

              <Field label="Ausführliche Beschreibung">
                <div className="bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors flex items-start gap-2 pt-3">
                  <FileText size={15} className="text-text-muted mt-0.5 shrink-0" />
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Geschichte, Stärken, Projekte, Arbeitsweise — in aller Ausführlichkeit."
                    className="bg-transparent border-none pb-3 text-sm flex-1 focus:outline-none resize-none"
                    maxLength={1500}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1 text-right">{description.length}/1500</p>
              </Field>

              <Field label="USP / Was macht euch einzigartig">
                <div className="flex items-start gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors pt-3">
                  <Quote size={15} className="text-text-muted mt-0.5 shrink-0" />
                  <textarea
                    rows={2}
                    value={usp}
                    onChange={(e) => setUsp(e.target.value)}
                    placeholder="Was unterscheidet euch von anderen? Euer Alleinstellungsmerkmal in 1–2 Sätzen."
                    className="bg-transparent border-none pb-3 text-sm flex-1 focus:outline-none resize-none"
                    maxLength={300}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1 text-right">{usp.length}/300</p>
              </Field>

              {/* Services tags */}
              <Field label="Leistungen / Stichworte">
                <div className="space-y-2">
                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((s) => (
                        <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-bg-elevated border border-border text-xs text-text-secondary rounded-full">
                          {s}
                          <button type="button" onClick={() => setServices((prev) => prev.filter((x) => x !== s))} className="hover:text-crimson-light ml-0.5">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                    <input
                      type="text"
                      value={serviceInput}
                      onChange={(e) => setServiceInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(); } }}
                      placeholder="z.B. HMI 6K, Dolly, Arri Alexa..."
                      className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                      maxLength={50}
                    />
                    <button
                      type="button"
                      onClick={addService}
                      disabled={!serviceInput.trim() || services.length >= 20}
                      className="text-text-muted hover:text-gold transition-colors disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted">Enter drücken zum Hinzufügen · {services.length}/20</p>
                </div>
              </Field>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <SectionDivider label="Kontakt" />

              <Field label="Website">
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <Globe size={15} className="text-text-muted shrink-0" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://www.eurewebsite.de"
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="E-Mail">
                  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                    <Mail size={15} className="text-text-muted shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@firma.de"
                      className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    />
                  </div>
                </Field>
                <Field label="Telefon">
                  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                    <Phone size={15} className="text-text-muted shrink-0" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+49 30 123456"
                      className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    />
                  </div>
                </Field>
              </div>
            </div>

            {/* Social Media */}
            <div className="space-y-4">
              <SectionDivider label="Social Media" />
              <p className="text-xs text-text-muted">Verlinkt eure sozialen Netzwerke — nur ausfüllen was vorhanden ist.</p>
              <div className="space-y-3">
                {([
                  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/eureprofil" },
                  { key: "linkedin",  label: "LinkedIn",  placeholder: "https://linkedin.com/company/eureseite" },
                  { key: "youtube",   label: "YouTube",   placeholder: "https://youtube.com/@euerkanal" },
                  { key: "vimeo",     label: "Vimeo",     placeholder: "https://vimeo.com/euerkanal" },
                  { key: "tiktok",    label: "TikTok",    placeholder: "https://tiktok.com/@eureprofil" },
                  { key: "facebook",  label: "Facebook",  placeholder: "https://facebook.com/eureseite" },
                ] as const).map(({ key, label, placeholder }) => (
                  <Field key={key} label={label}>
                    <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                      <Globe size={15} className="text-text-muted shrink-0" />
                      <input
                        type="url"
                        value={socialLinks[key] ?? ""}
                        onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                      />
                      {socialLinks[key]?.trim() && <CheckCircle size={15} className="text-success shrink-0" />}
                    </div>
                  </Field>
                ))}
              </div>
            </div>

            {/* Portfolio images */}
            <div className="space-y-3">
              <SectionDivider label="Portfolio-Bilder" />
              <p className="text-xs text-text-muted">Bis zu {MAX_PORTFOLIO} Bilder — zeigt eure Arbeit, euer Studio, euer Equipment.</p>

              <div className="grid grid-cols-4 gap-2">
                {portfolioImages.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPortfolioImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 p-1 bg-bg-primary/80 rounded-full hover:bg-crimson/80 transition-colors"
                    >
                      <Trash2 size={10} className="text-text-primary" />
                    </button>
                  </div>
                ))}
                {portfolioImages.length < MAX_PORTFOLIO && (
                  <button
                    type="button"
                    onClick={() => portfolioRef.current?.click()}
                    disabled={uploadingPortfolio}
                    className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-gold transition-colors flex flex-col items-center justify-center gap-1 bg-bg-secondary disabled:opacity-50"
                  >
                    {uploadingPortfolio ? (
                      <Loader2 size={18} className="animate-spin text-gold" />
                    ) : (
                      <>
                        <ImageIcon size={18} className="text-text-muted" />
                        <span className="text-[9px] text-text-muted">Hinzufügen</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input ref={portfolioRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePortfolioUpload} />
            </div>

            {error && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 rounded-xl text-sm text-crimson-light">{error}</div>
            )}

            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingPortfolio || !name.trim() || !city.trim()}
              className="w-full py-4 bg-gold text-bg-primary font-bold rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Wird gespeichert...</>
              ) : (
                <>{existingId ? "Änderungen speichern" : "Firmenprofil erstellen"} <ArrowRight size={16} /></>
              )}
            </button>

            <p className="text-center text-xs text-text-muted pt-1">
              Du kannst dein Profil jederzeit bearbeiten.
            </p>
          </form>

          {/* Team management — only shown when editing existing company */}
          {existingId && (
            <div className="mt-12 space-y-6">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2 flex items-center gap-1.5">
                  <Users size={12} /> Team verwalten
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {teamLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gold" />
                </div>
              ) : teamMembers.filter((m) => m.role !== "owner").length === 0 ? (
                <div className="text-center py-8 bg-bg-secondary border border-border rounded-2xl">
                  <Users size={32} className="mx-auto text-text-muted/30 mb-3" />
                  <p className="text-sm text-text-muted">Noch keine Beitrittsanfragen.</p>
                  <p className="text-xs text-text-muted/60 mt-1">Mitglieder können auf deiner Firmenseite beitreten.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Pending requests first */}
                  {teamMembers.filter((m) => m.status === "pending").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                        <Clock size={12} /> Ausstehende Anfragen ({teamMembers.filter((m) => m.status === "pending").length})
                      </p>
                      {teamMembers.filter((m) => m.status === "pending").map((m) => (
                        <TeamMemberRow
                          key={m.id}
                          member={m}
                          onAccept={() => handleAcceptMember(m.id)}
                          onRemove={() => handleRemoveMember(m.id)}
                          onTitleChange={(t) => handleUpdateTitle(m.id, t)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Accepted members (excluding owner — managed via "Meine Rolle" field above) */}
                  {teamMembers.filter((m) => m.status === "accepted" && m.role !== "owner").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-success flex items-center gap-1.5 mb-2">
                        <Check size={12} /> Aktive Mitglieder ({teamMembers.filter((m) => m.status === "accepted" && m.role !== "owner").length})
                      </p>
                      {teamMembers.filter((m) => m.status === "accepted" && m.role !== "owner").map((m) => (
                        <TeamMemberRow
                          key={m.id}
                          member={m}
                          onAccept={() => handleAcceptMember(m.id)}
                          onRemove={() => handleRemoveMember(m.id)}
                          onTitleChange={(t) => handleUpdateTitle(m.id, t)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProfileGuard>
  );
}

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  status: string;
  profile: { display_name: string; avatar_url: string | null; slug: string | null; role: string | null } | null;
};

function TeamMemberRow({
  member,
  onAccept,
  onRemove,
  onTitleChange,
}: {
  member: TeamMember;
  onAccept: () => void;
  onRemove: () => void;
  onTitleChange: (t: string) => void;
}) {
  const [title, setTitle] = useState(member.title ?? "");
  const [editing, setEditing] = useState(false);

  const name = member.profile?.display_name ?? member.user_id;
  const avatar = member.profile?.avatar_url;

  return (
    <div className="flex items-center gap-3 p-3 bg-bg-secondary border border-border rounded-xl">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-bg-elevated border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-text-muted">{name[0]?.toUpperCase()}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
        {editing ? (
          <div className="flex items-center gap-1 mt-0.5">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { onTitleChange(title); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { onTitleChange(title); setEditing(false); } }}
              placeholder="Titel / Position..."
              className="bg-transparent border-b border-gold text-xs text-text-primary focus:outline-none flex-1"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-text-muted hover:text-gold transition-colors truncate block"
          >
            {title || member.profile?.role || "Titel hinzufügen…"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {member.status === "pending" && (
          <button
            onClick={onAccept}
            className="p-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success transition-colors"
            title="Annehmen"
          >
            <Check size={13} />
          </button>
        )}
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg bg-crimson/5 hover:bg-crimson/20 text-text-muted hover:text-crimson-light transition-colors"
          title="Entfernen"
        >
          <UserX size={13} />
        </button>
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
        {label} {required && <span className="text-crimson-light">*</span>}
      </label>
      {children}
    </div>
  );
}
