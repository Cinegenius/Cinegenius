"use client";
import ResponsiblePersonFields, { focusResponsiblePerson } from "@/components/ResponsiblePersonFields";
import { EMPTY_RESPONSIBLE_PERSON, responsiblePersonDraft, responsiblePersonErrors, type ResponsiblePerson } from "@/lib/responsible-person";


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
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES, safeObjectURL } from "@/lib/compressImage";
import { MAX_COMPANY_GALLERY_IMAGES, moveCompanyGalleryImage } from "@/lib/company-media";
import { COMPANY_PUBLIC_TITLE_SUGGESTIONS, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import CompanyLogo from "@/components/CompanyLogo";
import CateringCompanyFields from "@/components/CateringCompanyFields";
import { CATERING_COMPANY_CATEGORY, EMPTY_CATERING_COMPANY_DETAILS, normalizeCateringCompanyDetails, type CateringCompanyDetails } from "@/lib/catering-taxonomy";

const MAX_PORTFOLIO = MAX_COMPANY_GALLERY_IMAGES;

type PendingCompanyImage = { id: string; file: File; previewUrl: string; status: "compressing" | "uploading" | "failed"; progress: number; replaceIndex?: number; error?: string };

function uploadCompanyImage(file: File, onProgress: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    request.open("POST", "/api/upload");
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(5, Math.min(95, Math.round(event.loaded / event.total * 100))));
    };
    request.onerror = () => reject(new Error("Netzwerkfehler beim Upload. Bitte dieses Foto erneut versuchen."));
    request.onabort = () => reject(new Error("Upload abgebrochen. Bitte dieses Foto erneut versuchen."));
    request.ontimeout = () => reject(new Error("Der Upload dauert zu lange. Prüfe deine Verbindung und versuche dieses Foto erneut."));
    request.onload = () => {
      let result: { url?: string; error?: string } = {};
      try { result = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !result.url) {
        reject(new Error(result.error ?? "Upload fehlgeschlagen. Bitte dieses Foto erneut versuchen."));
        return;
      }
      onProgress(100);
      resolve(result.url);
    };
    request.send(form);
  });
}

async function prepareCompanyImage(file: File, dimensions: { maxWidth: number; maxHeight: number }): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  return compressImage(file, { ...dimensions, quality: 0.84, maxBytes: MAX_FUNCTION_UPLOAD_BYTES, forceCompression: true });
}

export default function CompanySetupPage() {
  const { isLoaded, user } = useUser();
  const [responsible, setResponsible] = useState<ResponsiblePerson>(EMPTY_RESPONSIBLE_PERSON);
  const [responsibleErrors, setResponsibleErrors] = useState<Record<string, string>>({});
  const [responsibleAccountId, setResponsibleAccountId] = useState<string | null>(null);
  const router = useRouter();

  // Basic info
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailPublic, setEmailPublic] = useState(false);
  const [phonePublic, setPhonePublic] = useState(false);
  const [hqAddressPublic, setHqAddressPublic] = useState(false);

  // Logo
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const logoRef = useRef<HTMLInputElement>(null);

  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const coverRef = useRef<HTMLInputElement>(null);

  // Portfolio images
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [portfolioUploads, setPortfolioUploads] = useState<PendingCompanyImage[]>([]);
  const [replacePortfolioIndex, setReplacePortfolioIndex] = useState<number | null>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);
  const replacePortfolioInputRef = useRef<HTMLInputElement>(null);

  // Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [cateringDetails, setCateringDetails] = useState<CateringCompanyDetails>(EMPTY_CATERING_COMPANY_DETAILS);

  // Services (free text tags)
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState("");

  // Editing existing company
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [guidedSetup, setGuidedSetup] = useState(false);
  const [companyDraftLoaded, setCompanyDraftLoaded] = useState(false);
  const [companyDraftStatus, setCompanyDraftStatus] = useState("idle");
  const [companyStep, setCompanyStep] = useState(1);
  const [existingPublished, setExistingPublished] = useState(true);

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
  const [companyAccessRole, setCompanyAccessRole] = useState<"owner" | "admin" | "editor" | "member" | null>(null);
  const canManageTeam = companyAccessRole === "owner" || companyAccessRole === "admin";
  const isCompanyOwner = companyAccessRole === "owner";

  useEffect(() => {
    const isGuided = new URLSearchParams(window.location.search).get("onboarding") === "1";
    setGuidedSetup(isGuided);
    // Editors open their assigned company explicitly; owners keep the legacy shortcut.
    const requestedCompany = new URLSearchParams(window.location.search).get("company_id");
    fetch(requestedCompany ? `/api/companies?company_id=${encodeURIComponent(requestedCompany)}` : "/api/companies?mine=true")
      .then((r) => r.json())
      .then(({ data, permissionRole }) => {
        if (data && data.length > 0) {
          const c = data[0];
          setCompanyAccessRole(permissionRole ?? (c.owner_user_id ? "owner" : null));
          setExistingId(c.id);
          setResponsible(responsiblePersonDraft(c.responsible_person));
          setResponsibleAccountId(c.responsible_person?.userId || c.owner_user_id);
          setExistingPublished(c.published !== false);
          setName(c.name ?? "");
          setCity(c.city ?? "");
          setDescription(c.description ?? "");
          setWebsite(c.website ?? "");
          setEmail(c.email ?? "");
          setPhone(c.phone ?? "");
          setEmailPublic(c.email_public === true);
          setPhonePublic(c.phone_public === true);
          setHqAddressPublic(c.hq_address_public === true);
          setLogoUrl(c.logo_url ?? "");
          setLogoPreview(c.logo_url ?? "");
          setCoverUrl(c.cover_url ?? "");
          setCoverPreview(c.cover_url ?? "");
          setSelectedCategories(c.categories ?? []);
          setCateringDetails(normalizeCateringCompanyDetails(c.catering_details));
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
                if (ownerEntry) setOwnerTitle((ownerEntry.public_titles?.length ? ownerEntry.public_titles : ownerEntry.title ? [ownerEntry.title] : []).join(", "));
              }
            })
            .finally(() => setTeamLoading(false));
        }
        setLoading(false);
      })
      .catch((cause) => { setError(cause instanceof Error ? cause.message : "Das Firmenprofil konnte nicht geladen werden."); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!guidedSetup || loading || existingId) return;
    let active = true;
    fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Der private Entwurf konnte nicht geladen werden.");
      return result.draft?.companyDraft;
    }).then((draft) => {
      if (!active) return;
      if (draft) {
        setResponsible(responsiblePersonDraft(draft.responsible));
        setName(draft.name ?? ""); setCity(draft.city ?? ""); setDescription(draft.description ?? "");
        setWebsite(draft.website ?? ""); setEmail(draft.email ?? ""); setPhone(draft.phone ?? "");
        setEmailPublic(draft.emailPublic === true); setPhonePublic(draft.phonePublic === true); setHqAddressPublic(draft.hqAddressPublic === true);
        setLogoUrl(draft.logoUrl ?? ""); setLogoPreview(draft.logoUrl ?? "");
        setCoverUrl(draft.coverUrl ?? ""); setCoverPreview(draft.coverUrl ?? "");
        setPortfolioImages(draft.portfolioImages ?? []); setSelectedCategories(draft.selectedCategories ?? []);
        setCateringDetails(normalizeCateringCompanyDetails(draft.cateringDetails));
        setServices(draft.services ?? []); setTagline(draft.tagline ?? ""); setBioShort(draft.bioShort ?? "");
        setUsp(draft.usp ?? ""); setFoundedYear(draft.foundedYear ?? ""); setLegalForm(draft.legalForm ?? "");
        setHqAddress(draft.hqAddress ?? ""); setCountries(draft.countries ?? []);
        setIndustryFocus(draft.industryFocus ?? []); setSocialLinks(draft.socialLinks ?? {}); setOwnerTitle(draft.ownerTitle ?? "");
        setCompanyStep(Math.min(3, Math.max(1, Number(draft.step) || 1)));
      }
      setCompanyDraftLoaded(true);
    }).catch((cause) => {
      if (active) { setError(cause instanceof Error ? cause.message : "Der private Entwurf konnte nicht geladen werden."); setCompanyDraftLoaded(true); }
    });
    return () => { active = false; };
  }, [guidedSetup, loading, existingId]);

  useEffect(() => {
    if (!guidedSetup || !companyDraftLoaded || loading || existingId) return;
    const timer = setTimeout(async () => {
      setCompanyDraftStatus("saving");
      try {
        const response = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          intent: "company", setupComplete: false, companyDraft: { responsible, name, city, description, website, email, phone, emailPublic, phonePublic, hqAddressPublic, logoUrl, coverUrl, portfolioImages, selectedCategories, services, cateringDetails, tagline, bioShort, usp, foundedYear, legalForm, hqAddress, countries, industryFocus, socialLinks, ownerTitle, step: companyStep, updatedAt: new Date().toISOString() },
        }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Der Entwurf konnte nicht gespeichert werden.");
        setCompanyDraftStatus("saved");
      } catch (cause) {
        setCompanyDraftStatus("error");
        setError(cause instanceof Error ? cause.message : "Der Entwurf konnte nicht gespeichert werden.");
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [responsible, guidedSetup, companyDraftLoaded, loading, existingId, name, city, description, website, email, phone, emailPublic, phonePublic, hqAddressPublic, logoUrl, coverUrl, portfolioImages, selectedCategories, services, cateringDetails, tagline, bioShort, usp, foundedYear, legalForm, hqAddress, countries, industryFocus, socialLinks, ownerTitle, companyStep]);

  const handleSingleImageUpload = async (file: File | undefined, kind: "logo" | "cover") => {
    if (!file) return;
    const oldUrl = kind === "logo" ? logoUrl : coverUrl;
    const previewUrl = safeObjectURL(file);
    if (kind === "logo") { if (previewUrl) setLogoPreview(previewUrl); setUploadingLogo(true); setLogoProgress(0); }
    else { if (previewUrl) setCoverPreview(previewUrl); setUploadingCover(true); setCoverProgress(0); }
    setError("");
    try {
      const prepared = await prepareCompanyImage(file, kind === "logo" ? { maxWidth: 1200, maxHeight: 1200 } : { maxWidth: 2200, maxHeight: 1400 });
      const url = await uploadCompanyImage(prepared, (value) => kind === "logo" ? setLogoProgress(value) : setCoverProgress(value));
      if (kind === "logo") { setLogoUrl(url); setLogoPreview(url); }
      else { setCoverUrl(url); setCoverPreview(url); }
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Das Foto konnte nicht hochgeladen werden.");
      if (kind === "logo") setLogoPreview(oldUrl);
      else setCoverPreview(oldUrl);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    } finally {
      if (kind === "logo") setUploadingLogo(false);
      else setUploadingCover(false);
    }
  };

  const uploadPortfolioEntry = async (entry: PendingCompanyImage) => {
    const updateEntry = (change: Partial<PendingCompanyImage>) => setPortfolioUploads((current) => current.map((item) => item.id === entry.id ? { ...item, ...change } : item));
    updateEntry({ status: "compressing", progress: 0, error: undefined });
    try {
      const prepared = await prepareCompanyImage(entry.file, { maxWidth: 2200, maxHeight: 1800 });
      updateEntry({ status: "uploading", progress: 3 });
      const url = await uploadCompanyImage(prepared, (progress) => updateEntry({ progress }));
      if (entry.replaceIndex !== undefined) {
        setPortfolioImages((current) => current.map((old, index) => index === entry.replaceIndex ? url : old));
      } else {
        setPortfolioImages((current) => [...current, url]);
      }
      setPortfolioUploads((current) => current.filter((item) => item.id !== entry.id));
      if (entry.previewUrl.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
    } catch (cause) {
      updateEntry({ status: "failed", error: cause instanceof Error ? cause.message : "Upload fehlgeschlagen. Bitte dieses Foto erneut versuchen." });
    }
  };

  const handlePortfolioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const pendingCount = portfolioUploads.filter((item) => item.replaceIndex === undefined).length;
    const remaining = Math.max(0, MAX_PORTFOLIO - portfolioImages.length - pendingCount);
    if (files.length > remaining) setError(`Du kannst noch ${remaining} ${remaining === 1 ? "Foto" : "Fotos"} auswählen (maximal ${MAX_PORTFOLIO}).`);
    const entries = files.slice(0, remaining).map((file) => ({ id: crypto.randomUUID(), file, previewUrl: safeObjectURL(file) ?? "", status: "compressing" as const, progress: 0 }));
    if (!entries.length) return;
    setPortfolioUploads((current) => [...current, ...entries]);
    setUploadingPortfolio(true);
    for (const entry of entries) await uploadPortfolioEntry(entry);
    setUploadingPortfolio(false);
  };

  const retryPortfolioUpload = async (entry: PendingCompanyImage) => {
    setUploadingPortfolio(true);
    await uploadPortfolioEntry(entry);
    setUploadingPortfolio(false);
  };

  const replacePortfolioImage = (index: number) => {
    setReplacePortfolioIndex(index);
    replacePortfolioInputRef.current?.click();
  };

  const handleReplacePortfolioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const replaceIndex = replacePortfolioIndex;
    setReplacePortfolioIndex(null);
    if (!file || replaceIndex === null) return;
    const entry: PendingCompanyImage = { id: crypto.randomUUID(), file, previewUrl: safeObjectURL(file) ?? "", status: "compressing", progress: 0, replaceIndex };
    setPortfolioUploads((current) => [...current, entry]);
    setUploadingPortfolio(true);
    await uploadPortfolioEntry(entry);
    setUploadingPortfolio(false);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected && id === CATERING_COMPANY_CATEGORY.id) setCateringDetails(EMPTY_CATERING_COMPANY_DETAILS);
      return isSelected ? prev.filter((category) => category !== id) : [...prev, id];
    });
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
    const public_titles = normalizeCompanyPublicTitles(title);
    const response = await fetch("/api/company-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, public_titles }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Die Firmenfunktion konnte nicht gespeichert werden.");
      return;
    }
    setTeamMembers((current) => current.map((member) => member.id === id ? { ...member, public_titles, title: public_titles[0] ?? null } : member));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const personErrors = responsiblePersonErrors(responsible, true);
    setResponsibleErrors(personErrors);
    if (Object.keys(personErrors).length) { focusResponsiblePerson(); return; }
    if (!name.trim()) { setError("Firmenname ist ein Pflichtfeld."); return; }
    if (!city.trim()) { setError("Standort ist ein Pflichtfeld."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existingId,
          responsible_person: responsible,
          name, city, description, website, email, phone,
          email_public: emailPublic, phone_public: phonePublic, hq_address_public: hqAddressPublic,
          logo_url: logoUrl || null,
          categories: selectedCategories,
          services,
          catering_details: selectedCategories.includes(CATERING_COMPANY_CATEGORY.id) ? cateringDetails : EMPTY_CATERING_COMPANY_DETAILS,
          portfolio_images: portfolioImages,
          owner_title: ownerTitle.trim() || null,
          owner_titles: normalizeCompanyPublicTitles(ownerTitle),
          cover_url: coverUrl || null,
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
      if (guidedSetup) await fetch("/api/onboarding?type=company", { method: "DELETE" });
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
            {guidedSetup && !existingId && <p className="mt-3 text-xs text-text-muted">{companyDraftStatus === "saving" ? "Speichert deinen privaten Formularfortschritt …" : companyDraftStatus === "saved" ? "Dein Formularfortschritt ist privat gespeichert." : companyDraftStatus === "error" ? "Der letzte Stand konnte nicht gespeichert werden." : "Dein Formularfortschritt wird privat gespeichert."}</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <datalist id="company-title-suggestions">
              {COMPANY_PUBLIC_TITLE_SUGGESTIONS.map((title) => <option key={title} value={title} />)}
            </datalist>
            {guidedSetup && !existingId ? (
              <div className="space-y-6">
                <div aria-label={`Schritt ${companyStep} von 3`} className="space-y-2">
                  <div className="flex justify-between text-xs text-text-muted"><span>Firmenprofil</span><span>Schritt {companyStep} von 3</span></div>
                  <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(companyStep / 3) * 100}%` }} /></div>
                </div>

                {companyStep === 1 && (
                  <section className="space-y-5" aria-labelledby="company-step-one">
<ResponsiblePersonFields company value={responsible} onChange={setResponsible} errors={responsibleErrors} accountPrefill={!existingId || responsibleAccountId === user?.id} disabled={Boolean(existingId && responsibleAccountId && responsibleAccountId !== user?.id && !isCompanyOwner)} />
                    <div><h2 id="company-step-one" className="font-display text-2xl text-text-primary">Wie heißt dein Unternehmen?</h2><p className="mt-1 text-sm text-text-secondary">Nenne den Namen und den Ort, an dem ihr hauptsächlich arbeitet.</p></div>
                    <Field label="Firmenname" required>
                      <input autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zum Beispiel: Lichtblick Verleih" required className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-gold focus:outline-none" />
                    </Field>
                    <Field label="Stadt oder Region" required>
                      <input autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Zum Beispiel: Leipzig" required className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-gold focus:outline-none" />
                    </Field>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium text-text-primary">Was macht eure Firma? <span className="text-text-muted">(optional)</span></legend>
                      <div className="flex flex-wrap gap-2">
                        {COMPANY_CATEGORIES.map((category) => {
                          const active = selectedCategories.includes(category.id);
                          return <button key={category.id} type="button" aria-pressed={active} onClick={() => toggleCategory(category.id)} className={`min-h-11 rounded-full border px-3 py-2 text-sm transition-colors ${active ? "border-gold/50 bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40"}`}>{category.label}</button>;
                        })}
                      </div>
                      <p className="text-xs text-text-muted">Weitere Angaben kannst du später im Firmenprofil ergänzen.</p>
                    </fieldset>
                    {selectedCategories.includes(CATERING_COMPANY_CATEGORY.id) && <>
                      <CateringCompanyFields value={cateringDetails} onChange={setCateringDetails} />
                      <p className="text-xs text-text-muted">Wenn du diese Firmenkategorie abwählst, werden auch ihre Catering-Angaben entfernt.</p>
                    </>}
                  </section>
                )}

                {companyStep === 2 && (
                  <section className="space-y-5" aria-labelledby="company-step-two">
                    <div><h2 id="company-step-two" className="font-display text-2xl text-text-primary">Was sollen andere über euch wissen?</h2><p className="mt-1 text-sm text-text-secondary">Ein kurzer Einblick hilft, eure Firma einzuordnen. Diese Angaben sind optional.</p></div>
                    <Field label="Kurzvorstellung">
                      <textarea rows={3} value={bioShort} onChange={(e) => setBioShort(e.target.value)} maxLength={160} placeholder="Wir verleihen Kamera- und Lichtequipment an kleine Filmteams." className="w-full resize-y rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-gold focus:outline-none" />
                    </Field>
                    <Field label="Kurzer Leitsatz">
                      <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={100} placeholder="Zum Beispiel: Technik für gute Geschichten" className="w-full rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-gold focus:outline-none" />
                    </Field>
                    <Field label="Mehr über eure Arbeit (optional)">
                      <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500} placeholder="Beschreibe kurz eure Leistungen, Arbeitsweise oder Ausstattung." className="w-full resize-y rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm focus:border-gold focus:outline-none" />
                    </Field>
                  </section>
                )}

                {companyStep === 3 && (
                  <section className="space-y-5" aria-labelledby="company-step-three">
                    <div><h2 id="company-step-three" className="font-display text-2xl text-text-primary">Prüfen und Firma eintragen</h2><p className="mt-1 text-sm text-text-secondary">Nach dem Speichern wird dein Firmenprofil öffentlich auf CineGenius angezeigt. Du kannst es anschließend jederzeit bearbeiten.</p></div>
                    <div className="space-y-3 rounded-2xl border border-border bg-bg-secondary p-4">
                      <div><p className="text-xs uppercase tracking-wide text-text-muted">Unternehmen</p><p className="mt-1 font-semibold text-text-primary">{name || "Noch kein Firmenname"}</p><p className="text-sm text-text-secondary">{city || "Standort fehlt"}</p></div>
                      {selectedCategories.length > 0 && <div><p className="text-xs uppercase tracking-wide text-text-muted">Angebot</p><p className="mt-1 text-sm text-text-primary">{selectedCategories.map((id) => COMPANY_CATEGORIES.find((item) => item.id === id)?.label).filter(Boolean).join(", ")}</p></div>}
                      {selectedCategories.includes(CATERING_COMPANY_CATEGORY.id) && (cateringDetails.serviceTypes.length > 0 || cateringDetails.capacity || cateringDetails.serviceAreas) && <div><p className="text-xs uppercase tracking-wide text-text-muted">Catering</p><p className="mt-1 text-sm text-text-primary">{[...cateringDetails.serviceTypes, cateringDetails.capacity ? `Kapazität: bis ${cateringDetails.capacity} Personen` : "", cateringDetails.serviceAreas].filter(Boolean).join(" · ")}</p></div>}
                      {bioShort.trim() && <div><p className="text-xs uppercase tracking-wide text-text-muted">Kurzvorstellung</p><p className="mt-1 text-sm text-text-secondary">{bioShort}</p></div>}
                    </div>
                    <p className="text-xs leading-relaxed text-text-muted">Logo, Kontaktdaten, weitere Kategorien und Teamangaben kannst du später im Firmenprofil ergänzen.</p>
                  </section>
                )}

                {error && <div role="alert" className="rounded-xl border border-crimson/20 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</div>}
                <div className="flex gap-3 pt-2">
                  {companyStep > 1 && <button type="button" onClick={() => { setError(""); setCompanyStep((step) => step - 1); }} className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary hover:text-text-primary">Zurück</button>}
                  {companyStep < 3 ? (
                    <button type="button" onClick={() => { if (companyStep === 1) { const errors = responsiblePersonErrors(responsible, true); setResponsibleErrors(errors); if (Object.keys(errors).length) { focusResponsiblePerson(); return; } } if (companyStep === 1 && (!name.trim() || !city.trim())) { setError("Bitte Firmenname und Standort ergänzen."); return; } setError(""); setCompanyStep((step) => step + 1); }} className="min-h-12 flex-1 rounded-xl bg-gold px-4 text-sm font-bold text-bg-primary hover:bg-gold-light">Weiter <ArrowRight size={15} className="ml-1 inline" /></button>
                  ) : (
                    <button type="submit" disabled={saving || !name.trim() || !city.trim()} className="min-h-12 flex-1 rounded-xl bg-gold px-4 text-sm font-bold text-bg-primary hover:bg-gold-light disabled:opacity-50">{saving ? <><Loader2 size={15} className="mr-2 inline animate-spin" />Wird gespeichert…</> : <>Firma öffentlich eintragen <ArrowRight size={15} className="ml-1 inline" /></>}</button>
                  )}
                </div>
                <p className="text-center text-xs text-text-muted">{companyDraftStatus === "saving" ? "Speichert deinen privaten Formularfortschritt …" : companyDraftStatus === "saved" ? "Dein Formularfortschritt ist privat gespeichert." : companyDraftStatus === "error" ? "Der letzte Stand konnte nicht gespeichert werden." : "Dein Formularfortschritt wird privat gespeichert."}</p>
              </div>
            ) : (
              <>

            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <input id="logo-upload" ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/svg+xml" className="sr-only" onChange={(event) => { void handleSingleImageUpload(event.target.files?.[0], "logo"); event.currentTarget.value = ""; }} />
              <label
                htmlFor="logo-upload"
                className="relative w-full max-w-sm h-36 rounded-2xl border-2 border-dashed border-border hover:border-gold transition-colors group overflow-hidden bg-bg-secondary cursor-pointer block"
              >
                {logoPreview ? (
                  <CompanyLogo src={logoPreview} name={name || "Firmenlogo"} className="h-full w-full" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1.5">
                    <Upload size={22} className="text-text-muted group-hover:text-gold transition-colors" />
                    <span className="text-[10px] text-text-muted group-hover:text-gold">Logo hochladen</span>
                  </div>
                )}
                {uploadingLogo && <div className="absolute inset-0 bg-bg-primary/80 flex flex-col items-center justify-center gap-2"><Loader2 size={18} className="animate-spin text-gold" /><span className="text-[10px] text-text-primary">{logoProgress}%</span></div>}
              </label>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoPreview(""); setLogoUrl(""); }}
                  className="text-xs text-text-muted hover:text-crimson-light flex items-center gap-1 transition-colors"
                >
                  <X size={11} /> Entfernen
                </button>
              )}
              <p className="text-xs text-text-muted">JPG, PNG, WEBP, HEIC oder SVG · Vorschau ohne Beschnitt. Hat deine Datei große Außenränder, wähle eine enger zugeschnittene Version. Originaldateien werden nicht automatisch beschnitten.</p>
            </div>

            {/* Company cover image */}
            <div className="space-y-3">
              <SectionDivider label="Titelbild" />
              <p className="text-xs text-text-muted">Ein Titelbild zeigt eure Räume, euer Team oder eure Arbeit. JPG, PNG, WEBP und HEIC werden passend verarbeitet.</p>
              <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(event) => { void handleSingleImageUpload(event.target.files?.[0], "cover"); event.currentTarget.value = ""; }} />
              <button type="button" onClick={() => coverRef.current?.click()} disabled={uploadingCover} className="relative block min-h-36 w-full overflow-hidden rounded-xl border border-dashed border-border bg-bg-secondary text-left hover:border-gold/50 disabled:opacity-60">
                {coverPreview ? <img src={coverPreview} alt="Vorschau des Firmentitelbilds" className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex min-h-36 flex-col items-center justify-center gap-2 text-sm text-text-muted"><ImageIcon size={20} /> Titelbild auswählen</span>}
                {coverPreview && !uploadingCover && <span className="absolute bottom-2 left-2 rounded-lg bg-bg-primary/85 px-3 py-2 text-xs text-text-primary">Titelbild ersetzen</span>}
                {uploadingCover && <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-primary/75 text-sm text-text-primary"><Loader2 size={18} className="animate-spin text-gold" />Upload {coverProgress}%</span>}
              </button>
              {coverPreview && !uploadingCover && <button type="button" onClick={() => { setCoverPreview(""); setCoverUrl(""); }} className="inline-flex min-h-10 items-center gap-2 text-xs text-text-muted hover:text-crimson-light"><X size={13} /> Titelbild entfernen</button>}
            </div>

            <ResponsiblePersonFields company value={responsible} onChange={setResponsible} errors={responsibleErrors} accountPrefill={!existingId || responsibleAccountId === user?.id} disabled={Boolean(existingId && responsibleAccountId && responsibleAccountId !== user?.id && !isCompanyOwner)} />
            {/* Basic info */}
            <div className="space-y-4">
              <SectionDivider label="Pflichtfelder" />

              <Field label="Firmenname" required>
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <Building2 size={15} className="text-text-muted shrink-0" />
                  <input
                    list="company-title-suggestions"
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
              {selectedCategories.includes(CATERING_COMPANY_CATEGORY.id) && <>
                <CateringCompanyFields value={cateringDetails} onChange={setCateringDetails} />
                <p className="text-xs text-text-muted">Wenn du diese Firmenkategorie abwählst, werden auch ihre Catering-Angaben entfernt.</p>
              </>}
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
                  "Dokumentarfilm", "Event", "Hochzeit", "Theater", "Animation", "VFX / Post",
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
              <label className="flex items-start gap-2.5 text-xs text-text-muted">
                <input type="checkbox" checked={hqAddressPublic} onChange={(event) => setHqAddressPublic(event.target.checked)} className="mt-0.5 accent-gold" />
                <span>Genaue Geschäftsadresse auf dem öffentlichen Firmenprofil anzeigen. Ohne Auswahl bleibt sie privat.</span>
              </label>
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
            {isCompanyOwner && <div className="space-y-4">
              <SectionDivider label="Deine Funktion" />
              <Field label="Meine öffentliche Funktion in der Firma">
                <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-xl px-3.5 focus-within:border-gold transition-colors">
                  <Briefcase size={15} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={ownerTitle}
                    onChange={(e) => setOwnerTitle(e.target.value)}
                    placeholder="z.B. Geschäftsführer/in, Produzent/in"
                    className="bg-transparent border-none py-3 text-sm flex-1 focus:outline-none"
                    maxLength={400}
                  />
                  {ownerTitle && <CheckCircle size={15} className="text-success shrink-0" />}
                </div>
                <p className="text-[11px] text-text-muted mt-1">Erscheint öffentlich auf deinem Profil und im Team der Firma. Mehrere Funktionen kannst du mit Komma trennen. Das verleiht keine Verwaltungsrechte.</p>
              </Field>
            </div>}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-2.5 text-xs text-text-muted">
                  <input type="checkbox" checked={emailPublic} onChange={(event) => setEmailPublic(event.target.checked)} className="mt-0.5 accent-gold" />
                  <span>Diese geschäftliche E-Mail öffentlich anzeigen.</span>
                </label>
                <label className="flex items-start gap-2.5 text-xs text-text-muted">
                  <input type="checkbox" checked={phonePublic} onChange={(event) => setPhonePublic(event.target.checked)} className="mt-0.5 accent-gold" />
                  <span>Diese geschäftliche Telefonnummer öffentlich anzeigen.</span>
                </label>
              </div>
              <p className="text-[11px] text-text-muted">Deine Anmelde-E-Mail wird nicht übernommen. Nur die hier eingetragenen Firmendaten können mit deiner ausdrücklichen Auswahl öffentlich erscheinen.</p>
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

            {/* Company gallery */}
            <div className="space-y-3">
              <SectionDivider label="Firmen-Galerie" />
              <p className="text-xs text-text-muted">Bis zu {MAX_PORTFOLIO} Fotos von Team, Räumen, Equipment oder Arbeitsbeispielen. Das erste Foto steht vorne im öffentlichen Profil. {portfolioImages.length}/{MAX_PORTFOLIO}</p>
              <input ref={portfolioRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={(event) => void handlePortfolioUpload(event)} />
              <input ref={replacePortfolioInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(event) => void handleReplacePortfolioUpload(event)} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {portfolioImages.map((url, index) => (
                  <div key={`${index}-${url}`} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-bg-secondary">
                    <img src={url} alt={`Firmenfoto ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-2 left-2 rounded-md bg-bg-primary/85 px-2 py-1 text-[10px] font-semibold text-text-primary">{index === 0 ? "Hauptfoto" : `Foto ${index + 1}`}</span>
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button type="button" onClick={() => setPortfolioImages((current) => moveCompanyGalleryImage(current, index, index - 1))} disabled={index === 0 || uploadingPortfolio} aria-label={`Foto ${index + 1} nach vorne verschieben`} className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-primary/90 text-text-primary disabled:opacity-40"><ChevronUp size={15} /></button>
                      <button type="button" onClick={() => setPortfolioImages((current) => moveCompanyGalleryImage(current, index, index + 1))} disabled={index === portfolioImages.length - 1 || uploadingPortfolio} aria-label={`Foto ${index + 1} nach hinten verschieben`} className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-primary/90 text-text-primary disabled:opacity-40"><ChevronDown size={15} /></button>
                    </div>
                    <div className="absolute inset-x-2 bottom-2 flex justify-end gap-2">
                      <button type="button" onClick={() => replacePortfolioImage(index)} disabled={uploadingPortfolio} className="min-h-9 rounded-lg bg-bg-primary/90 px-2.5 text-[10px] font-semibold text-text-primary disabled:opacity-50">Ersetzen</button>
                      <button type="button" onClick={() => setPortfolioImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={uploadingPortfolio} aria-label={`Foto ${index + 1} entfernen`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary/90 text-text-primary hover:text-crimson-light"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                {portfolioImages.length + portfolioUploads.filter((item) => item.replaceIndex === undefined).length < MAX_PORTFOLIO && <button type="button" onClick={() => portfolioRef.current?.click()} disabled={uploadingPortfolio} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-text-muted hover:border-gold/50 hover:text-gold disabled:opacity-50"><Plus size={20} /><span className="text-xs">Fotos hinzufügen</span></button>}
                {portfolioUploads.map((item) => (
                  <div key={item.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-bg-secondary">
                    {item.previewUrl && <img src={item.previewUrl} alt="Ausgewähltes Firmenfoto" className="h-full w-full object-cover opacity-60" />}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-primary/75 p-3 text-center">
                      {item.status === "failed" ? <><p role="alert" className="text-[11px] text-crimson-light">{item.error}</p><button type="button" onClick={() => void retryPortfolioUpload(item)} disabled={uploadingPortfolio} className="min-h-9 rounded-lg bg-gold px-3 text-xs font-bold text-bg-primary">Erneut versuchen</button></> : <><Loader2 size={18} className="animate-spin text-gold" /><span className="text-xs text-text-primary">{item.status === "compressing" ? "Foto wird vorbereitet …" : `Upload ${item.progress}%`}</span><div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated"><div className="h-full bg-gold transition-[width]" style={{ width: `${item.status === "compressing" ? 10 : item.progress}%` }} /></div></>}
                    </div>
                    {item.status === "failed" && <button type="button" onClick={() => { if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl); setPortfolioUploads((current) => current.filter((upload) => upload.id !== item.id)); }} aria-label="Fehlgeschlagenen Upload entfernen" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-bg-primary text-text-primary"><X size={14} /></button>}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-crimson/10 border border-crimson/20 rounded-xl text-sm text-crimson-light">{error}</div>
            )}

            <p className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm leading-6 text-text-secondary">
              {existingId && !existingPublished
                ? "Dieses bisher private Firmenprofil wird mit dem Speichern öffentlich auffindbar."
                : "Das Firmenprofil wird nach dem Speichern öffentlich auf CineGenius angezeigt."}
            </p>

            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingCover || uploadingPortfolio || !name.trim() || !city.trim()}
              className="w-full py-4 bg-gold text-bg-primary font-bold rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Wird gespeichert...</>
              ) : (
                <>{existingId ? "Änderungen speichern" : "Firmenprofil erstellen"} <ArrowRight size={16} /></>
              )}
            </button>

              <p className="text-center text-xs text-text-muted pt-1">
              Du kannst dein öffentliches Profil jederzeit bearbeiten.
            </p>
              </>
            )}
          </form>

          {/* Team management — only shown when editing existing company */}
          {existingId && canManageTeam && (
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
  );
}

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  public_titles?: string[] | null;
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
  const [title, setTitle] = useState((member.public_titles?.length ? member.public_titles : member.title ? [member.title] : []).join(", "));
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
              list="company-title-suggestions"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { onTitleChange(title); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onTitleChange(title); setEditing(false); } }}
              placeholder="Mehrere Funktionen mit Komma trennen …"
              className="bg-transparent border-b border-gold text-xs text-text-primary focus:outline-none flex-1"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-text-muted hover:text-gold transition-colors truncate block"
          >
            {title || member.profile?.role || "Funktion hinzufügen…"}
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
