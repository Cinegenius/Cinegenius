"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, Upload, Calendar, DollarSign, FileText, Sparkles } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

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
    addToast("Auftrag eingereicht! Hersteller melden sich innerhalb von 48 Stunden.", "success");
  };

  if (submitted) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
            Brief eingereicht!
          </h1>
          <p className="text-text-muted mb-2 leading-relaxed">
            Dein Auftrag für <strong className="text-text-primary">{form.title}</strong> wurde in unserem Hersteller-Netzwerk veröffentlicht.
          </p>
          <p className="text-text-muted text-sm mb-8">
            Qualifizierte Hersteller reichen innerhalb von 24–48 Stunden Angebote ein. Du erhältst E-Mail-Benachrichtigungen, sobald Angebote eintreffen.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/marketplace"
              className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors"
            >
              Hersteller durchsuchen
            </Link>
            <button
              onClick={() => { setSubmitted(false); setStep(0); setForm({ title:"",propType:"",description:"",quantity:"1",deadline:"",flexible:false,budget:"",negotiable:false,references:"",notes:"",contactName:"",contactEmail:"",production:"" }); }}
              className="text-sm text-text-muted hover:text-gold transition-colors"
            >
              Weiteren Brief einreichen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-8">
          <ArrowLeft size={14} /> Zurück zum Marktplatz
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-subtle border border-gold/20 rounded-full text-gold text-xs font-medium mb-3">
            <Sparkles size={11} /> Auftragsanfrage
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Auftrag ausschreiben</h1>
          <p className="text-text-muted text-sm">Beschreibe was du brauchst — qualifizierte Hersteller senden dir Angebote.</p>
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
                {label}
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
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Projekttitel *
                </label>
                <input
                  type="text"
                  placeholder="z. B. Viktorianische Straßenlaterne (6er-Set)"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Requisiten-Typ *
                </label>
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
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Beschreibung *
                </label>
                <textarea
                  rows={5}
                  placeholder="Beschreibe die Requisite detailliert: Abmessungen, Materialien, Epoche/Stil, Verwendungszweck, Genauigkeitsanforderungen..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>

              <div className="max-w-xs">
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Menge
                </label>
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
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Benötigt bis *
                </label>
                <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
                  <Calendar size={15} className="text-text-muted" />
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                    className="bg-transparent border-none py-2.5 text-sm flex-1 focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.flexible}
                    onChange={(e) => set("flexible", e.target.checked)}
                    className="accent-gold"
                  />
                  <span className="text-xs text-text-muted">Deadline ist flexibel</span>
                </label>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Budgetrahmen *
                </label>
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
                      {b}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.negotiable}
                    onChange={(e) => set("negotiable", e.target.checked)}
                    className="accent-gold"
                  />
                  <span className="text-xs text-text-muted">Offen für Verhandlung beim richtigen Hersteller</span>
                </label>
              </div>
            </div>
          )}

          {/* SCHRITT 2 — Referenzen */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Referenzbilder / Links
                </label>
                <textarea
                  rows={4}
                  placeholder="Bild-URLs, Pinterest-Boards, Google Drive-Links oder andere Referenzen einfügen..."
                  value={form.references}
                  onChange={(e) => set("references", e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                />
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors cursor-pointer">
                <Upload size={24} className="text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-1">Referenzdateien hierher ziehen</p>
                <p className="text-xs text-text-muted">PNG, JPG, PDF bis 20 MB pro Datei</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Weitere Hinweise
                </label>
                <textarea
                  rows={3}
                  placeholder="Weitere Anforderungen, Produktionseinschränkungen oder besondere Wünsche..."
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
                <h3 className="font-semibold text-text-primary text-sm">Brief-Zusammenfassung</h3>
                {[
                  { label: "Titel", value: form.title },
                  { label: "Typ", value: form.propType },
                  { label: "Menge", value: form.quantity },
                  { label: "Deadline", value: form.flexible ? `${form.deadline} (flexibel)` : form.deadline },
                  { label: "Budget", value: form.negotiable ? `${form.budget} (verhandelbar)` : form.budget },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-text-muted">{label}</span>
                    <span className="text-text-primary font-medium">{value || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Kontakt */}
              <div className="space-y-4">
                <h3 className="font-semibold text-text-primary text-sm">Deine Kontaktdaten</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Name *</label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">E-Mail *</label>
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => set("contactEmail", e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Produktionsfirma</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={form.production}
                      onChange={(e) => set("production", e.target.value)}
                      className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-text-muted">
                Mit dem Einreichen stimmst du unseren Nutzungsbedingungen zu. Dein Brief ist nur für verifizierte Hersteller in unserem Netzwerk sichtbar.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="px-5 py-2.5 border border-border text-text-secondary text-sm font-medium rounded-lg hover:border-gold hover:text-gold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
            >
              <ArrowLeft size={14} /> Zurück
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
              >
                Weiter <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext()}
                className="px-6 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
              >
                <FileText size={14} /> Brief einreichen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
