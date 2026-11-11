"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Send, CheckCircle, Shield, Clock, ChevronRight, Loader2, LogIn } from "lucide-react";
import { uiErrorMessage } from "@/lib/ui-error-message";

type Props = {
  listingId: string;
  listingTitle: string;
  listingType: "creator" | "location" | "vehicle" | "prop" | "job" | "animal";
  ownerId: string;
  ownerName: string;
};

export default function InquiryForm({ listingId, listingTitle, listingType, ownerId, ownerName }: Props) {
  const uiText = useTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Spielfilm": uiText("Ui.text_031b1c1fc4b241"),
    "Kurzfilm": uiText("Ui.text_75b346d26e4973"),
    "Werbung": uiText("home.showcaseAds"),
    "Musikvideo": uiText("projects.catMusikvideo"),
    "Dokumentarfilm": uiText("Ui.text_e2dec20c086399"),
    "Corporate": uiText("projects.catCorporate"),
    "TV / Episodic": uiText("Ui.text_13faef85f075ea"),
    "Sonstiges": uiText("profile.typeOther"),
  };






  const router = useRouter();
  const animals = useTranslations("FilmAnimals");
  const marketplaceText = useTranslations("MarketplaceNavigation");
  const { user, isLoaded } = useUser();
  const isMarketplace = listingType === "prop" || listingType === "vehicle";

  const [step, setStep] = useState<"form" | "sent">("form");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [projectTitle, setProjectTitle] = useState("");
  const [projectType, setProjectType] = useState(isMarketplace ? "" : "Spielfilm");
  const [message, setMessage] = useState("");

  const firstName = ownerName.split(" ")[0];
  const fieldPrefix = `inquiry-${listingType}-${listingId}`;
  const canSubmit = (isMarketplace || projectTitle.trim().length >= 2) && message.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSending(true);
    setError("");

    const body = [
      ...(!isMarketplace || projectTitle.trim() ? [uiText("Ui.text_8d608163879370", { value1: String(projectTitle) })] : []),
      ...(!isMarketplace || projectType ? [uiText("Ui.text_a1d9fa86c76302", { value1: String(uiOptionLabels[projectType] ?? projectType) })] : []),
      ...(!isMarketplace || projectTitle.trim() || projectType ? [""] : []),
      message.trim(),
    ].join("\n");

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          listing_title: listingTitle,
          listing_type: listingType,
          receiver_id: ownerId,
          content: body,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? uiText("Ui.text_3d5d6608b0a99d"));

      setStep("sent");
    } catch (err) {
      setError(uiErrorMessage(err, uiText("Ui.text_3d5d6608b0a99d")));
    } finally {
      setSending(false);
    }
  };

  if (!isLoaded) return null;

  if (!user) {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center mx-auto">
          <LogIn size={20} className="text-gold" />
        </div>
        <p className="text-sm text-text-secondary">{uiText("Ui.text_62455765e835b2")}</p>
        <button
          onClick={() => {
            const destination = `${window.location.pathname}${window.location.search}`;
            router.push(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
          }}
          className="block w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors text-center"
        >{uiText("nav.signIn")}</button>
      </div>
    );
  }

  if (step === "sent") {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={28} className="text-success" />
        </div>
        <h3 className="font-display text-lg font-bold text-text-primary">{uiText("Ui.text_3cc5126c50dc13")}</h3>
        <p className="text-text-muted text-sm leading-relaxed">{isMarketplace ? marketplaceText("inquirySentDescription") : uiText.rich("Ui.text_e4dd24c2d55cda", { value2: () => (firstName), part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
        {!isMarketplace && <div className="p-3 bg-gold-subtle border border-gold/20 rounded-lg text-xs text-text-muted text-left">
          <p className="font-semibold text-gold mb-1 flex items-center gap-1">{uiText.rich("Ui.text_605c7e279ae588", { part1: () => (<Clock size={11} />) })}</p>
          <p>{uiText("Ui.text_6966ffcd9cb0f2")}</p>
        </div>}
        <button
          onClick={() => router.push("/dashboard?tab=messages")}
          className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors"
        >{uiText("Ui.text_58cc26037bfb14")}</button>
        <button
          onClick={() => { setStep("form"); setProjectTitle(""); setMessage(""); }}
          className="text-xs text-text-muted hover:text-gold transition-colors"
        >{uiText("Ui.text_856b904fe4d314")}</button>
      </div>
    );
  }

  const projectFields = <>
        <div>
          <label htmlFor={`${fieldPrefix}-project-title`} className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{isMarketplace ? marketplaceText("projectTitleOptional") : uiText.rich("Ui.text_c8034bf7e6ff4f", { part1: chunks => (<span className="text-crimson-light">{chunks}</span>) })}</label>
          <input
            type="text"
            id={`${fieldPrefix}-project-title`}
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder={uiText("Ui.text_226852491cb014")}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
          />
        </div>

        <div>
          <label htmlFor={`${fieldPrefix}-project-type`} className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{isMarketplace ? marketplaceText("projectTypeOptional") : uiText("jobs.filterProjectType")}</label>
          <select
            id={`${fieldPrefix}-project-type`}
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
          >
            {isMarketplace && <option value="">{marketplaceText("noProjectType")}</option>}
            {["Spielfilm", "Kurzfilm", "Werbung", "Musikvideo", "Dokumentarfilm", "Corporate", "TV / Episodic", "Sonstiges"].map((t) => (
              <option key={t} value={t}>{(uiOptionLabels[t] ?? t)}</option>
            ))}
          </select>
        </div>
      </>;
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-0.5">{isMarketplace ? uiText("nav.marketplace") : listingType === "animal" ? animals("portfolio") : uiText("creators.bookingInquiry")}</p>
        <h3 className="font-display text-lg font-bold text-text-primary">{isMarketplace ? marketplaceText("inquiryTitle") : uiText("FilmAnimals.inquire")}</h3>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">{isMarketplace ? marketplaceText("inquiryDescription") : uiText("Ui.text_6dc178870f3592")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isMarketplace && projectFields}
        <div>
          <label htmlFor={`${fieldPrefix}-message`} className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText.rich("Ui.text_9cd8ccfc52b590", { part1: chunks => (<span className="text-crimson-light">{chunks}</span>) })}</label>
          <textarea
            rows={4}
            id={`${fieldPrefix}-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={uiText("Ui.text_a553f27db747b9", { value1: String(firstName) })}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
          />
        </div>

        {isMarketplace && <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">{marketplaceText("projectDetailsOptional")}</summary><div className="mt-3 space-y-4">{projectFields}</div></details>}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || sending}
          className={`w-full py-3 font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
            canSubmit && !sending
              ? "bg-gold text-bg-primary hover:bg-gold-light"
              : "bg-border text-text-muted cursor-not-allowed"
          }`}
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? uiText("Ui.text_e37bd862386549") : uiText("BookingRequest.send")}
        </button>

        <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1">{uiText.rich("Ui.text_a707682ed384f0", { part1: () => (<Shield size={11} />) })}</p>
      </form>

      {!isMarketplace && <div className="pt-4 border-t border-border">
        <p className="text-xs font-semibold text-gold mb-2 flex items-center gap-1">{uiText.rich("Ui.text_8637f2606012e6", { part1: () => (<ChevronRight size={12} />) })}</p>
        <ol className="space-y-1.5 text-xs text-text-muted">
          <li className="flex items-start gap-2">{uiText.rich("Ui.text_7de71ee2fdf1d0", { part1: chunks => (<span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">{chunks}</span>) })}</li>
          <li className="flex items-start gap-2">{uiText.rich("Ui.text_ca61e238cc742c", { part1: chunks => (<span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">{chunks}</span>), value2: () => (firstName) })}</li>
          <li className="flex items-start gap-2">{uiText.rich("Ui.text_adef1a1ff07a96", { part1: chunks => (<span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">{chunks}</span>) })}</li>
          <li className="flex items-start gap-2"><span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">4</span>{listingType === "animal" ? animals("conditions") : uiText("Ui.text_a2b623648c930c")}</li>
        </ol>
      </div>}
    </div>
  );
}
