"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ArrowLeft, Send, Calendar, FileText, Euro, User,
  CheckCircle, Loader2, AlertCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


type ProfileSnippet = {
  display_name: string | null;
  avatar_url: string | null;
  slug: string | null;
};

function BookingContent() {
  const uiText = useTranslations();

  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const profileId = searchParams.get("profile");

  const [profile, setProfile] = useState<ProfileSnippet | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(!!profileId);

  // Form state
  const [projectTitle, setProjectTitle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/profile/by-id?id=${profileId}`)
      .then((r) => r.json())
      .then(({ profile: p }) => {
        setProfile(p ?? null);
        setLoadingProfile(false);
      })
      .catch(() => setLoadingProfile(false));
  }, [profileId]);

  const canSubmit =
    projectTitle.trim() &&
    description.trim() &&
    !sending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !profileId || !user) return;
    setSending(true);
    setError("");

    const lines = [
      uiText("Ui.text_7864c35f5dbbcf", { value1: String(projectTitle) }),
      projectType ? uiText("Ui.text_a1d9fa86c76302", { value1: String(projectType) }) : null,
      startDate ? uiText("Ui.text_8527b34cb3b239", { value1: String(startDate) }) : null,
      endDate ? uiText("Ui.text_7181522dc2fe18", { value1: String(endDate) }) : null,
      budget ? uiText("Ui.text_f0833f747f48d5", { value1: String(budget) }) : null,
      "",
      description,
    ]
      .filter((l) => l !== null)
      .join("\n");

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: profileId, content: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? uiText("Ui.text_f6cc01cb7edbf0"));
      setSent(true);
      setTimeout(() => {
        router.push(`/messages`);
      }, 2500);
    } catch (err) {
      setError(uiErrorMessage(err, uiText("profile.unknownError")));
      setSending(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle size={32} className="text-gold" />
        <h2 className="font-display text-xl font-bold text-text-primary">{uiText("Ui.text_6638bb26a46e61")}</h2>
        <p className="text-text-muted text-sm">{uiText("Ui.text_c50e0a46055250")}</p>
        <Link href="/sign-in" className="px-6 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl text-sm hover:bg-gold-light transition-colors">{uiText("nav.signIn")}</Link>
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle size={32} className="text-gold" />
        <h2 className="font-display text-xl font-bold text-text-primary">{uiText("Ui.text_94ba797801e6a5")}</h2>
        <p className="text-text-muted text-sm">{uiText("Ui.text_318a3dff5971ec")}</p>
        <Link href="/creators" className="text-gold hover:text-gold-light text-sm">{uiText("Ui.text_f969063744ddd5")}</Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle size={28} className="text-emerald-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary">{uiText("Ui.text_3cc5126c50dc13")}</h2>
        <p className="text-text-muted text-sm max-w-xs">{uiText("Ui.text_52352ff756e7e2")}</p>
        <Loader2 size={16} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const recipientName = loadingProfile
    ? uiText("Ui.text_7a72dd7b9d46f7")
    : (profile?.display_name ?? uiText("Ui.text_276ffa1fb4f970"));

  return (
    <div className="min-h-screen bg-bg-primary pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:border-gold hover:text-gold transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">{uiText("creators.bookingInquiry")}</h1>
            <p className="text-xs text-text-muted">{uiText("Ui.text_71b3ec21cf65c7")}</p>
          </div>
        </div>

        {/* Recipient */}
        <div className="flex items-center gap-3 p-4 bg-bg-secondary border border-border rounded-2xl mb-8">
          <div className="w-11 h-11 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-text-muted" />
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-text-muted font-semibold">{uiText("Ui.text_a91844e2712512")}</p>
            <p className="text-sm font-semibold text-text-primary">{recipientName}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">{uiText("Ui.text_e0d579ec866601")}</label>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder={uiText("Ui.text_5f14ed0f4b7f5a")}
                className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">{uiText("jobs.filterProjectType")}</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
            >
              <option value="">{uiText("Ui.text_5a65d3a10117a6")}</option>
              <option value="Kurzfilm">{uiText("Ui.text_75b346d26e4973")}</option>
              <option value="Spielfilm">{uiText("Ui.text_031b1c1fc4b241")}</option>
              <option value="Werbespot">{uiText("Ui.text_d6303193bd0e4f")}</option>
              <option value="Musikvideo">{uiText("projects.catMusikvideo")}</option>
              <option value="Dokumentation">{uiText("projects.catDokumentation")}</option>
              <option value="Serie / TV">{uiText("Ui.text_75c196fdbc2c09")}</option>
              <option value="Fotoshooting">{uiText("Ui.text_c0d9cacb8fb6f8")}</option>
              <option value="Social Media Content">{uiText("Ui.text_130e3fc256922c")}</option>
              <option value="Sonstiges">{uiText("profile.typeOther")}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">{uiText("Ui.text_4a48ddb0bc0012")}</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">{uiText("Ui.text_ebd9aa50c1bd39")}</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">{uiText("Ui.text_2233e1ec9e1d09")}</label>
            <div className="relative">
              <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="800"
                className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">{uiText("Ui.text_a01c894e08ee46")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={uiText("Ui.text_f22532dbdad4d2")}
              rows={5}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-3 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium"
            >{uiText("home.boardCancel")}</button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {sending ? (
                <>{uiText.rich("Ui.text_05951578d673af", { part1: () => (<Loader2 size={15} className="animate-spin" />) })}</>
              ) : (
                <>{uiText.rich("Ui.text_7daf877c2674dc", { part1: () => (<Send size={15} />) })}</>
              )}
            </button>
          </div>

          <p className="text-xs text-text-muted text-center">{uiText.rich("Ui.text_db1e1939a2605a", { part1: chunks => (<Link href="/messages" className="text-gold hover:text-gold-light">{chunks}</Link>) })}</p>
        </form>
      </div>
    </div>
  );
}

export default function BookingPage() {
  const uiText = useTranslations();

  return (
    <Suspense fallback={<div className="pt-32 text-center text-text-muted">{uiText("Ui.text_b89b8cdb9d6d6f")}</div>}>
      <BookingContent />
    </Suspense>
  );
}
