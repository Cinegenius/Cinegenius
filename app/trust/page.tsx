import Link from "next/link";
import {
  Shield, CheckCircle, AlertCircle, RotateCcw, MessageSquare,
  Clock, Banknote, ArrowRight, Lock, Eye, Flag,
} from "lucide-react";

const sections = [
  {
    icon: Lock,
    title: "Sichere Zahlung & Treuhand",
    id: "payment",
    content: [
      {
        heading: "Wie funktioniert die Treuhand?",
        body: "Wenn du eine Buchung abschließt, wird deine Zahlung von CineGenius treuhänderisch gehalten — nicht direkt an den Anbieter übertragen. Das Geld wird erst nach erfolgreichem Abschluss der Buchung freigegeben.",
      },
      {
        heading: "Wann wird das Geld freigegeben?",
        body: "Für Locations und Requisiten: 24 Stunden nach dem Enddatum der Buchung, sofern kein Streitfall gemeldet wurde. Für Crew-Buchungen: nach Bestätigung durch beide Parteien oder 48 Stunden nach dem letzten Drehtag.",
      },
      {
        heading: "Welche Zahlungsmethoden werden akzeptiert?",
        body: "Kreditkarten (Visa, Mastercard, Amex), SEPA-Lastschrift und Sofortüberweisung — alle verarbeitet über Stripe, einem PCI-DSS-zertifizierten Zahlungsdienstleister.",
      },
    ],
  },
  {
    icon: RotateCcw,
    title: "Stornierungsrichtlinien",
    id: "cancellation",
    content: [
      {
        heading: "Flexible Richtlinie",
        body: "Vollständige Rückerstattung bei Stornierung bis 48 Stunden vor Buchungsbeginn. Danach: 50 % Rückerstattung. Keine Rückerstattung bei Stornierung weniger als 24 Stunden vorher.",
      },
      {
        heading: "Moderate Richtlinie",
        body: "Vollständige Rückerstattung bei Stornierung bis 7 Tage vor Buchungsbeginn. 50 % Rückerstattung bei Stornierung 3–7 Tage vorher. Keine Rückerstattung bei weniger als 3 Tagen.",
      },
      {
        heading: "Strenge Richtlinie",
        body: "Vollständige Rückerstattung nur innerhalb von 48 Stunden nach der Buchung (sofern Beginn mehr als 7 Tage entfernt). Danach keine Rückerstattung — empfohlen für stark nachgefragte Locations.",
      },
    ],
  },
  {
    icon: AlertCircle,
    title: "Streitfall & Schadensmeldung",
    id: "disputes",
    content: [
      {
        heading: "Wie melde ich einen Streitfall?",
        body: "Gehe in dein Dashboard → Buchungen → wähle die betreffende Buchung → klicke auf 'Streitfall melden'. Du hast 72 Stunden nach Buchungsende Zeit, einen Fall zu eröffnen.",
      },
      {
        heading: "Was passiert nach der Meldung?",
        body: "Unser Trust & Safety Team meldet sich innerhalb von 24 Stunden. Die Treuhandzahlung wird eingefroren, bis der Fall gelöst ist. Beide Parteien können Belege einreichen.",
      },
      {
        heading: "Schadensregelung",
        body: "Anbieter können eine Schadenskaution verlangen, die vor Buchungsbeginn hinterlegt wird. Im Schadensfall werden Belege (Fotos, Kostenvoranschläge) benötigt. CineGenius vermittelt — der endgültige Betrag wird nach Prüfung freigegeben oder erstattet.",
      },
    ],
  },
  {
    icon: Eye,
    title: "Verifizierung & Vertrauen",
    id: "verification",
    content: [
      {
        heading: "Was bedeutet das Verifizierungs-Badge?",
        body: "Verifizierte Anbieter haben ihre Identität (Personalausweis oder Reisepass) und — bei Locations — den Eigentumsnachweis oder die Nutzungsberechtigung nachgewiesen. Verifizierte Crew-Profile haben mindestens 2 bestätigte Credits.",
      },
      {
        heading: "Wie werden Bewertungen geprüft?",
        body: "Nur abgeschlossene Buchungen können bewertet werden. Bewertungen können nicht nachträglich geändert werden. Unser System erkennt und entfernt verdächtige Muster (z. B. Fake-Bewertungen).",
      },
      {
        heading: "Wie melde ich ein verdächtiges Inserat?",
        body: "Über den 'Melden'-Button auf jeder Angebots- oder Profilseite. Gemeldete Inhalte werden innerhalb von 48 Stunden geprüft und bei Verstoß gegen unsere Richtlinien entfernt.",
      },
    ],
  },
];

const quickFacts = [
  { icon: Banknote, stat: "100 %", label: "Zahlungen über Treuhand" },
  { icon: Clock, stat: "24h", label: "Support-Reaktionszeit" },
  { icon: Shield, stat: "0 €", label: "Keine versteckten Gebühren" },
  { icon: CheckCircle, stat: "94 %", label: "Buchungszufriedenheit" },
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
            Treuhandzahlungen, Identitätsverifizierung und ein dediziertes Support-Team —
            damit jede Buchung so abläuft, wie sie soll.
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
          <div className="flex-1 space-y-12">
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
                  Verdächtiges Inserat, Betrugsversuch oder unsicheres Verhalten? Unser Team reagiert innerhalb von 24 Stunden.
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
