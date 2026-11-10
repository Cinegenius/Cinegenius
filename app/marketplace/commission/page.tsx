"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, Upload, Calendar, FileText, Sparkles } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useTranslations } from "next-intl";


const steps = ["Brief", "Zeitplan & Budget", "Referenzen", "Prüfen & Einreichen"];

const propTypes = [
  "Waffen & Rüstungen", "Beschriftung & Typografie", "Animatronik / Kreaturen",
  "Maßstabsmodelle / Miniaturen", "Möbel / Bühnenbild", "Kostümteile / Bekleidung",
  "Elektronik / Requisiten", "Fahrzeuge / Transport", "Sonstiges",
];

const budgetRanges = [
  "Unter 500 €", "500 € – 1.000 €", "1.000 € – 2.500 €", "2.500 € – 5.000 €",
  "5.000 € – 10.000 €", "10.000 € – 25.000 €", "25.000 €+",
];

export default function CommissionPage() {
  const uiText = useTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Brief": uiText("Ui.text_ac40ae1e8d4129"),
    "Zeitplan & Budget": uiText("Ui.text_9b294710ffda71"),
    "Referenzen": uiText("Ui.text_d9825991644fde"),
    "Prüfen & Einreichen": uiText("Ui.text_9da47fb87b83b4"),
    "Waffen & Rüstungen": uiText("Ui.text_5b6d841ed4e466"),
    "Beschriftung & Typografie": uiText("Ui.text_dd69b4faaac7d8"),
    "Animatronik / Kreaturen": uiText("Ui.text_864c420968b73b"),
    "Maßstabsmodelle / Miniaturen": uiText("Ui.text_6622bcbf28a20a"),
    "Möbel / Bühnenbild": uiText("Ui.text_e5c384a327ac87"),
    "Kostümteile / Bekleidung": uiText("Ui.text_12182db52c5587"),
    "Elektronik / Requisiten": uiText("Ui.text_1ccb5dcf8e64a3"),
    "Fahrzeuge / Transport": uiText("Ui.text_4b2ab1a9fd72e9"),
    "Sonstiges": uiText("profile.typeOther"),
    "Unter 500 €": uiText("Ui.text_427b10b80d0eee"),
  };






  const { addToast } = useToast();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    title: "",
    propType: "",
    description: "",
    quantity: "1",
    deadline: "",
    flexible: false,
    budget: "",
    negotiable: false,
    references: "",
    notes: "",
    contactName: "",
    contactEmail: "",
    production: "",
  });

  const set = (key: string, val: string | boolean) =>
    setForm((p) => ({ ...p, [key]: val }));

  const canNext = () => {
    if (step === 0) return form.title && form.propType && form.description;
    if (step === 1) return form.deadline && form.budget;
    if (step === 2) return true;
    if (step === 3) return form.contactName && form.contactEmail;
    return true;
  };

  const handleSubmit = () => {
    setSubmitted(true);
    addToast(uiText("Ui.text_482faeb83395de"), "success");
  };

  if (submitted) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-3">{uiText("Ui.text_e4f277861f92ad")}</h1>
          <p className="text-text-muted mb-2 leading-relaxed">{uiText.rich("Ui.text_c0db7fc7653231", { value2: () => (form.title), part1: chunks => (<strong className="text-text-primary">{chunks}</strong>) })}</p>
          <p className="text-text-muted text-sm mb-8">{uiText("Ui.text_d60c2e3683cd43")}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/marketplace"
              className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors"
            >{uiText("Ui.text_1b0abb2ded61db")}</Link>
            <button
              onClick={() => { setSubmitted(false); setStep(0); setForm({ title:"",propType:"",description:"",quantity:"1",deadline:"",flexible:false,budget:"",negotiable:false,references:"",notes:"",contactName:"",contactEmail:"",production:"" }); }}
              className="text-sm text-text-muted hover:text-gold transition-colors"
            >{uiText("Ui.text_190381fb049ee9")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-8">{uiText.rich("Ui.text_e36e18db08afaa", { part1: () => (<ArrowLeft size={14} />) })}</Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-subtle border border-gold/20 rounded-full text-gold text-xs font-medium mb-3">{uiText.rich("Ui.text_794ba66277c627", { part1: () => (<Sparkles size={11} />) })}</div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{uiText("Ui.text_b8f0732cb36038")}</h1>
          <p className="text-text-muted text-sm">{uiText("Ui.text_6a5fa4ea7bad80")}</p>
        </div>

        {/* Schrittanzeige */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? "bg-success text-white" : i === step ? "bg-gold text-bg-primary" : "bg-bg-elevated border border-border text-text-muted"
              }`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-text-primary font-medium" : "text-text-muted"}`}>
                {(uiOptionLabels[label] ?? label)}
              </span>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-success/40" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-bg-secondary border border-border rounded-2xl p-6 sm:p-8">
          {/* SCHRITT 0 — Brief */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_e0d579ec866601")}</label>
                <input
                  type="text"
                  placeholder={uiText("Ui.text_b3a54b68874fc5")}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_483ee18545772c")}</label>
                <div className="flex flex-wrap gap-2">
                  {propTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("propType", t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        form.propType === t
                          ? "bg-gold text-bg-primary border-gold"
                          : "border-border text-text-secondary hover:border-gold hover:text-gold"
                      }`}
                    >
                      {(uiOptionLabels[t] ?? t)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_9589f97d46a1ee")}</label>
                <textarea
                  rows={5}
                  placeholder={uiText("Ui.text_03c345c4621140")}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>

              <div className="max-w-xs">
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_1bece813ec41fb")}</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          )}

          {/* SCHRITT 1 — Zeitplan & Budget */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_0bbd7e73943831")}</label>
                <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
                  <Calendar size={15} className="text-text-muted" />
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                    className="bg-transparent border-none py-2.5 text-sm flex-1 focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">{uiText.rich("Ui.text_cf9fcfb9bfce36", { part1: () => (<input
                    type="checkbox"
                    checked={form.flexible}
                    onChange={(e) => set("flexible", e.target.checked)}
                    className="accent-gold"
                  />), part2: chunks => (<span className="text-xs text-text-muted">{chunks}</span>) })}</label>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_5996cc76dec8bc")}</label>
                <div className="flex flex-wrap gap-2">
                  {budgetRanges.map((b) => (
                    <button
                      key={b}
                      onClick={() => set("budget", b)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        form.budget === b
                          ? "bg-gold text-bg-primary border-gold"
                          : "border-border text-text-secondary hover:border-gold hover:text-gold"
                      }`}
                    >
                      {(uiOptionLabels[b] ?? b)}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">{uiText.rich("Ui.text_98e91a6eafa89e", { part1: () => (<input
                    type="checkbox"
                    checked={form.negotiable}
                    onChange={(e) => set("negotiable", e.target.checked)}
                    className="accent-gold"
                  />), part2: chunks => (<span className="text-xs text-text-muted">{chunks}</span>) })}</label>
              </div>
            </div>
          )}

          {/* SCHRITT 2 — Referenzen */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_c0b5134983762a")}</label>
                <textarea
                  rows={4}
                  placeholder={uiText("Ui.text_73579ea1ed6582")}
                  value={form.references}
                  onChange={(e) => set("references", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors cursor-pointer">
                <Upload size={24} className="text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-1">{uiText("Ui.text_c773beb7e188f1")}</p>
                <p className="text-xs text-text-muted">{uiText("Ui.text_f833b52fa9cf38")}</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_f2dcf1ec5f7996")}</label>
                <textarea
                  rows={3}
                  placeholder={uiText("Ui.text_d5b1e9fcc3bd84")}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* SCHRITT 3 — Prüfen & Einreichen */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Zusammenfassung */}
              <div className="p-4 bg-bg-elevated border border-border rounded-xl space-y-3">
                <h3 className="font-semibold text-text-primary text-sm">{uiText("Ui.text_843ef40820fb5f")}</h3>
                {[
                  { label: uiText("projects.colTitle"), value: form.title },
                  { label: uiText("projects.colType"), value: form.propType },
                  { label: uiText("Ui.text_1bece813ec41fb"), value: form.quantity },
                  { label: uiText("Ui.text_6fcb38ddc858fc"), value: form.flexible ? uiText("Ui.text_64edd25f3fcdb6", { value1: String(form.deadline) }) : form.deadline },
                  { label: uiText("Ui.text_1c6225ec7092ad"), value: form.negotiable ? uiText("Ui.text_47ff4345eacdc2", { value1: String(form.budget) }) : form.budget },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-text-muted">{label}</span>
                    <span className="text-text-primary font-medium">{value || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Kontakt */}
              <div className="space-y-4">
                <h3 className="font-semibold text-text-primary text-sm">{uiText("Ui.text_eee7c5ac7eae95")}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_862fead051bea9")}</label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_7368dce2f90eee")}</label>
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => set("contactEmail", e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("profile.labelProductionCompany")}</label>
                    <input
                      type="text"
                      placeholder={uiText("setup.copy38")}
                      value={form.production}
                      onChange={(e) => set("production", e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-text-muted">{uiText("Ui.text_8e13b7dc506079")}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="px-5 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-lg hover:border-gold hover:text-gold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
            >{uiText.rich("Ui.text_3c9cbf8b79d036", { part1: () => (<ArrowLeft size={14} />) })}</button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
              >{uiText.rich("Ui.text_71f09a8b7c811b", { part1: () => (<ArrowRight size={14} />) })}</button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext()}
                className="px-6 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
              >{uiText.rich("Ui.text_973526ac1716f3", { part1: () => (<FileText size={14} />) })}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
