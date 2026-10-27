import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vertrauen & Sicherheit",
  description: "Informationen zu Kontakt, Anfragen, Sichtbarkeit und dem Melden problematischer Inhalte auf CineGenius.",
};
import {
  Shield, CheckCircle, AlertCircle, RotateCcw, MessageSquare,
  ArrowRight, Lock, Eye, Flag,
} from "lucide-react";

const sections = [
  { icon: Lock, title: "Anfragen & Vereinbarungen", id: "payment", content: [
    { heading: "Wie kommt ein Kontakt zustande?", body: "Öffentliche Angebote kannst du ohne Konto entdecken. Für Nachrichten und Anfragen meldest du dich an. Eine Anfrage ist noch keine Zusage des Anbieters." },
    { heading: "Wie wird bezahlt?", body: "Preis, Verfügbarkeit, Zahlung und Übergabe vereinbaren die Beteiligten miteinander. Eine Anfrage löst keine automatische Zahlung aus. CineGenius verspricht keine Treuhandverwahrung oder Auszahlung zu festen Fristen." },
    { heading: "Worauf sollte ich achten?", body: "Prüfe Angebot und Anbieter, kläre den Leistungsumfang und halte Vereinbarungen schriftlich fest. Überweise kein Geld allein aufgrund eines vermeintlichen Plattform-Gütesiegels." },
  ] },
  { icon: RotateCcw, title: "Stornierung & Änderungen", id: "cancellation", content: [
    { heading: "Welche Bedingungen gelten?", body: "Kläre Stornierung, Terminänderungen, Kaution und mögliche Kosten vor einer Zusage direkt mit dem Anbieter. Maßgeblich sind eure Vereinbarung und die gesetzlichen Rechte." },
    { heading: "Erstattet CineGenius automatisch?", body: "Es gibt keine allgemeine automatische Rückerstattung durch CineGenius. Wende dich bei Fragen zur vereinbarten Leistung oder Zahlung zunächst an deinen Vertragspartner." },
  ] },
  { icon: AlertCircle, title: "Probleme & Meldungen", id: "disputes", content: [
    { heading: "Wie melde ich ein Problem?", body: "Nutze die vorhandene Melden-Funktion am Profil oder Angebot oder sende den betroffenen Link mit einer Beschreibung an cinegenius.co@gmail.com. Teile nur die für die Prüfung notwendigen Informationen." },
    { heading: "Was passiert anschließend?", body: "Berechtigte Verantwortliche prüfen die Meldung. Eine feste Bearbeitungszeit oder eine Erstattung kann nicht pauschal zugesichert werden. Supportunterhaltungen können von berechtigten Supportadministratoren bearbeitet werden." },
    { heading: "Wer ist für Schäden verantwortlich?", body: "Kläre Haftung, Versicherungen und eventuelle Kautionen vor dem Einsatz mit deinem Vertragspartner. Eine Plattformanfrage enthält keinen automatischen Versicherungsschutz." },
  ] },
  { icon: Eye, title: "Profile, Bewertungen & Sichtbarkeit", id: "verification", content: [
    { heading: "Was bedeutet eine Kennzeichnung?", body: "Beachte die jeweils angezeigte Kennzeichnung und ihren konkreten Bezug. Ein Profil ist keine pauschale Garantie für Identität, Qualifikation, Eigentum oder die Qualität jeder angebotenen Leistung." },
    { heading: "Wer kann bewerten?", body: "Für Bewertungen prüft die Plattform die jeweils erforderliche Berechtigung anhand zugehöriger Vorgänge. Inhalte können gemeldet und geprüft werden; ein automatischer Schutz vor jeder falschen Bewertung wird nicht zugesichert." },
    { heading: "Wer sieht meine Daten?", body: "Öffentliche Inhalte bleiben auffindbar. Persönliche Kontaktdaten richten sich nach den Sichtbarkeitseinstellungen und Zugriffsrechten. Eine öffentliche Firmenfunktion vergibt keine Verwaltungsrechte." },
  ] },
];

const quickFacts = [
  { icon: MessageSquare, stat: "Kontakt", label: "Direkt miteinander sprechen" },
  { icon: Flag, stat: "Melden", label: "Problematische Inhalte melden" },
  { icon: Shield, stat: "Sichtbarkeit", label: "Eigene Angaben verwalten" },
  { icon: CheckCircle, stat: "Anfragen", label: "Konditionen vorab klären" },
];

export default function TrustSafetyPage() {
  return (
    <div className="pt-16 min-h-screen">
      {/* Hero */}
      <div className="relative py-16 bg-bg-secondary border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-success/10 border border-success/20 rounded-full text-success text-xs font-medium mb-5">
            <Shield size={12} /> Trust & Safety
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 leading-tight">
            Deine Sicherheit hat Priorität.
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
            Informiere dich über Anbieter, kläre Vereinbarungen direkt und nutze die
            Meldefunktionen, wenn dir problematische Inhalte auffallen.
          </p>
        </div>
      </div>

      {/* Quick Facts */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickFacts.map(({ icon: Icon, stat, label }) => (
            <div key={label} className="p-5 bg-bg-secondary border border-border rounded-xl text-center">
              <div className="w-10 h-10 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Icon size={18} className="text-success" />
              </div>
              <div className="font-display text-2xl font-bold text-text-primary mb-1">{stat}</div>
              <div className="text-xs text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex gap-10 flex-col lg:flex-row">

          {/* Sidebar nav */}
          <aside className="lg:w-56 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-3 mb-3">Themen</p>
              {sections.map(({ icon: Icon, title, id }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-elevated hover:text-gold transition-all"
                >
                  <Icon size={14} className="text-gold/70 shrink-0" />
                  {title}
                </a>
              ))}
              <div className="pt-4 mt-4 border-t border-border">
                <Link
                  href="/help"
                  className="flex items-center gap-2 px-3 py-2 text-xs text-gold hover:text-gold-light transition-colors"
                >
                  <MessageSquare size={12} /> Hilfe-Center <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </aside>

          {/* Sections */}
          <div className="flex-1 min-w-0 space-y-12 [overflow-wrap:anywhere]">
            {sections.map(({ icon: Icon, title, id, content }) => (
              <section key={id} id={id} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gold/10 border border-gold/20 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-gold" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-text-primary">{title}</h2>
                </div>
                <div className="space-y-5">
                  {content.map(({ heading, body }) => (
                    <div key={heading} className="p-5 bg-bg-secondary border border-border rounded-xl">
                      <h3 className="font-semibold text-text-primary mb-2">{heading}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Report CTA */}
            <div className="p-6 bg-bg-secondary border border-border rounded-xl flex items-start gap-4">
              <div className="w-10 h-10 bg-crimson/10 border border-crimson/20 rounded-xl flex items-center justify-center shrink-0">
                <Flag size={16} className="text-crimson-light" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-1">Etwas melden</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-3">
                  Verdächtiges Inserat, Betrugsversuch oder unsicheres Verhalten? Melde uns den betroffenen Inhalt mit einer kurzen Beschreibung.
                </p>
                <Link
                  href="/help"
                  className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold-light transition-colors font-medium"
                >
                  Support kontaktieren <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
