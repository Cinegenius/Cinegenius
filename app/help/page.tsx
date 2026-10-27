"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp, MessageSquare, Mail, BookOpen, MapPin, Package, Briefcase, Shield, Car, PawPrint } from "lucide-react";

const categories = [
  {
    icon: BookOpen,
    label: "Erste Schritte",
    items: [
      {
        q: "Was ist CineGenius?",
        a: "CineGenius ist der kostenlose Marktplatz für die Film- und Medienbranche im DACH-Raum. Du findest hier Locations, Crew & Talente, Requisiten, Equipment, Fahrzeuge, Tiere für Produktionen und offene Jobs — alles an einem Ort, direkt ohne Vermittlungsagentur.",
      },
      {
        q: "Brauche ich ein Konto zum Stöbern?",
        a: "Nein — du kannst alle Locations, Requisiten, Jobs und Filmschaffenden ohne Registrierung durchsuchen. Ein Konto brauchst du nur, um Kontakt aufzunehmen, dich auf Jobs zu bewerben oder eigene Angebote einzustellen.",
      },
      {
        q: "Ist CineGenius kostenlos?",
        a: "Registrierung, Profile, Suche und Inserate sind derzeit kostenlos. Preise für gemietete Gegenstände, Locations oder Dienstleistungen vereinbarst du mit dem jeweiligen Anbieter.",
      },
      {
        q: "Wie nehme ich Kontakt mit einem Anbieter auf?",
        a: "Jedes Inserat hat einen Kontakt-Button. Damit öffnest du direkt die interne Nachrichtenfunktion. Alle weiteren Absprachen — Preise, Verfügbarkeit, Konditionen — klärt ihr direkt miteinander.",
      },
    ],
  },
  {
    icon: MapPin,
    label: "Locations",
    items: [
      {
        q: "Wie stelle ich meine Location ein?",
        a: "Melde dich an, öffne „Inserat erstellen“ und wähle „Location“. Ergänze Grunddaten, Drehbedingungen, bis zu 20 Fotos sowie Preis und Verfügbarkeit. Du kannst einen Entwurf speichern und veröffentlichst erst über die entsprechende Aktion.",
      },
      {
        q: "Kann ich eine Location vor der Anmietung besichtigen?",
        a: "Frage den Anbieter, ob eine Besichtigung vor Ort oder per Video möglich ist. Eine Besichtigung ist nicht automatisch Bestandteil eines Angebots.",
      },
      {
        q: "Wie werden Preise und Konditionen vereinbart?",
        a: "Preise und Konditionen werden direkt zwischen Anbieter und Produktion ausgehandelt. CineGenius stellt nur die Kontaktmöglichkeit bereit — keine Buchungsgebühren, keine Provision.",
      },
    ],
  },
  {
    icon: Package,
    label: "Requisiten & Verleih",
    items: [
      {
        q: "Wie funktioniert der Requisiten-Verleih auf CineGenius?",
        a: "Du findest den gewünschten Artikel, siehst Fotos und Beschreibung, und nimmst dann direkt Kontakt mit dem Anbieter auf. Verfügbarkeit, Mietdauer und Abholung klärt ihr persönlich — CineGenius ist das Verzeichnis, der Rest läuft direkt zwischen euch.",
      },
      {
        q: "Kann ich Requisiten ans Set liefern lassen?",
        a: "Das entscheidet jeder Anbieter selbst. Frag einfach per Nachricht an, ob Lieferung möglich ist und was sie kostet.",
      },
      {
        q: "Was mache ich, wenn ein Anbieter nicht antwortet?",
        a: "Wenn du innerhalb von 2–3 Tagen keine Antwort erhältst, kannst du es nochmals versuchen oder einen anderen Anbieter kontaktieren. Du kannst uns auch unter cinegenius.co@gmail.com melden, wenn ein Inserat veraltet oder inaktiv wirkt.",
      },
    ],
  },
  {
    icon: Car,
    label: "Fahrzeuge",
    items: [
      {
        q: "Welche Fahrzeuge finde ich auf CineGenius?",
        a: "Auf CineGenius findest du Bild-Fahrzeuge (z. B. klassische Autos, Motorräder), Produktionsfahrzeuge (Kostümbus, Maske & Hair, Equipment-Transporter, Generator-Fahrzeuge, Darsteller-Trailer u. v. m.) sowie Oldtimer und Spezialfahrzeuge für Filmproduktionen.",
      },
      {
        q: "Wie stelle ich mein Fahrzeug ein?",
        a: "Klicke auf 'Inserat erstellen' und wähle die Kategorie 'Fahrzeug'. Für Produktionsfahrzeuge kannst du zusätzlich den genauen Fahrzeugtyp angeben (z. B. Kostümbus oder Generator-Fahrzeug). Speichere dein Angebot zunächst als Entwurf oder veröffentliche es mit der dafür vorgesehenen Aktion.",
      },
      {
        q: "Wie wird die Miete / der Einsatz vereinbart?",
        a: "Preise, Verfügbarkeit und Konditionen klärt ihr direkt mit dem Anbieter per Nachricht. CineGenius stellt nur die Kontaktmöglichkeit bereit — keine Provision, keine Buchungsgebühren.",
      },
    ],
  },
  {
    icon: PawPrint,
    label: "Tiere",
    items: [
      {
        q: "Kann ich Tiere für meine Produktion über CineGenius buchen?",
        a: "Ja — im Bereich 'Tiere' findest du ausgebildete Filmtiere und erfahrene Tiertrainer/-innen für Foto- und Filmproduktionen. Von Hunden und Pferden bis zu Exoten — die Anbieter listen ihre Tiere mit Fotos, Ausbildungsstand und Einsatzbereichen.",
      },
      {
        q: "Wie stelle ich mein Tier / meine Tieragentur ein?",
        a: "Klicke auf 'Inserat erstellen' und wähle die Kategorie 'Tiere'. Beschreibe das Tier, seinen Ausbildungsstand und bisherige Produktionen, und lade aussagekräftige Fotos hoch.",
      },
      {
        q: "Welche Voraussetzungen gelten für Tiere am Set?",
        a: "Das ist Sache der jeweiligen Produktion und des Tierhalters. CineGenius empfiehlt, Tierschutzanforderungen, Versicherung und Betreuung vor Drehbeginn schriftlich zu klären. Halter und Produktion sind eigenverantwortlich für das Wohl der Tiere am Set.",
      },
    ],
  },
  {
    icon: Briefcase,
    label: "Jobs & Crew",
    items: [
      {
        q: "Wie bewerbe ich mich auf einen Job?",
        a: "Gehe zum Job-Inserat und nutze den Kontakt-Button oder das Bewerbungsformular. Du kannst eine Kurzbewerbung schreiben und dein Portfolio verlinken. Die weitere Kommunikation läuft direkt mit der Produktion.",
      },
      {
        q: "Werden meine Daten bei einer Bewerbung weitergegeben?",
        a: "Der Empfänger sieht deine Bewerbung und die dazu vorgesehenen Profilangaben. Öffentlich freigegebene Profilinhalte sind für Besucher sichtbar; persönliche Kontaktdaten richten sich nach deinen Sichtbarkeitseinstellungen.",
      },
      {
        q: "Können Produktionen Jobs kostenlos ausschreiben?",
        a: "Jobs einstellen, Crew suchen und Bewerbungen über die vorhandenen Funktionen versenden ist derzeit kostenlos.",
      },
      {
        q: "Wie erstelle ich ein Crew-Profil?",
        a: "Nach der E-Mail-Bestätigung führt dich die Einrichtung durch Name, Ort, gewünschte Bereiche und passende Tätigkeiten. Mehrere Gewerke und Tätigkeiten sind möglich. Später bearbeitest du dein Profil in „Mein Bereich“. Ob es öffentlich erscheint, hängt von der vorgesehenen Sichtbarkeit ab.",
      },
    ],
  },
  {
    icon: BookOpen,
    label: "Firmen & Fotos",
    items: [
      { q: "Wie präsentiere ich meine Firma oder mein Catering?", a: "Wähle bei der Einrichtung eine Firma oder Dienstleistung und ergänze Branche und Leistungen. Mehrere passende Bereiche einschließlich Catering sind möglich. Ein neues Firmenprofil wird beim Speichern öffentlich; Entwürfe anderer Angebotsarten bleiben bis zur Veröffentlichung privat." },
      { q: "Wie verknüpfe ich mein Profil mit einer Firma?", a: "Auf dem Firmenprofil findest du unter „Weitere Aktionen“ die Firmenzugehörigkeitsanfrage. Wähle Funktionen und ergänze bei Bedarf eine Nachricht. Erst nach Bestätigung erscheint die Zugehörigkeit öffentlich. Firmenverantwortliche können bereits registrierte Mitglieder einladen; auch diese Einladung muss angenommen werden." },
      { q: "Wie viele Fotos kann ich hochladen?", a: "Im Marktplatz sind bis zu 10 Fotos pro Artikel und bei Locations bis zu 20 Fotos möglich. Die jeweiligen Formulare zeigen unterstützte Formate und Größenlimits. Persönliche Profile und Firmen haben eigene Foto- und Galerieeingaben." },
      { q: "Welche Bilder erscheinen in „Frische Einblicke“?", a: "Öffentlich sichtbare Profilfotos, Cover und direkt hochgeladene persönliche Portfoliofotos sowie Firmenlogos, Firmen-Cover und Firmengalerien können automatisch erscheinen. Projekt-, Marktplatz-, Location- und Schwarzes-Brett-Bilder sowie private Inhalte und Nachrichtenanhänge gehören nicht dazu." },
    ],
  },
  {
    icon: Shield,
    label: "Sicherheit & Vertrauen",
    items: [
      {
        q: "Ist CineGenius seriös?",
        a: "CineGenius verbindet Menschen und Angebote für Film, Fotografie und Content. Angaben stammen von den jeweiligen Mitgliedern. Prüfe wichtige Details direkt mit dem Anbieter; auffällige Inhalte kannst du melden.",
      },
      {
        q: "Wie melde ich ein verdächtiges Inserat?",
        a: "Schreib uns einfach an cinegenius.co@gmail.com mit dem Link zum Inserat und einer kurzen Beschreibung. Wir prüfen Meldungen; eine feste Bearbeitungszeit wird nicht zugesichert.",
      },
      {
        q: "Was passiert mit meinen Daten?",
        a: "Deine Daten werden ausschließlich zur Bereitstellung der Plattform verwendet und nicht an Dritte verkauft. Details findest du in unserer Datenschutzerklärung.",
      },
    ],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));

  const filtered = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          !query.trim() ||
          item.q.toLowerCase().includes(query.toLowerCase()) ||
          item.a.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter(
      (cat) =>
        (!activeCategory || cat.label === activeCategory) && cat.items.length > 0
    );

  return (
    <div className="pt-16 min-h-screen">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">
            Hilfe-Center
          </h1>
          <p className="text-text-muted mb-8">
            Alles, was du über die Nutzung von CineGenius wissen musst.
          </p>
          <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-4 focus-within:border-gold transition-colors">
            <Search size={16} className="text-text-muted" />
            <input
              type="text"
              placeholder="Antworten suchen..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none py-3.5 text-sm w-full focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Category tabs */}
        {!query && (
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                !activeCategory
                  ? "bg-gold text-bg-primary border-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >
              Alle Themen
            </button>
            {categories.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActiveCategory(activeCategory === label ? null : label)}
                className={`px-4 py-2 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  activeCategory === label
                    ? "bg-gold text-bg-primary border-gold"
                    : "border-border text-text-secondary hover:border-gold hover:text-gold"
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* FAQ Sections */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-2">Keine Ergebnisse für &ldquo;{query}&rdquo;</p>
            <button
              onClick={() => setQuery("")}
              className="text-gold text-sm hover:text-gold-light transition-colors"
            >
              Suche zurücksetzen
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map(({ label, icon: Icon, items }) => (
              <section key={label}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon size={16} className="text-gold" />
                  <h2 className="font-display text-lg font-bold text-text-primary">{label}</h2>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const key = `${label}-${item.q}`;
                    const isOpen = openItems[key];
                    return (
                      <div key={key} className="border border-border rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-bg-elevated transition-colors"
                        >
                          <span className="text-sm font-medium text-text-primary">{item.q}</span>
                          {isOpen ? (
                            <ChevronUp size={15} className="text-gold shrink-0" />
                          ) : (
                            <ChevronDown size={15} className="text-text-muted shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed border-t border-border pt-4">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="mt-16 p-8 bg-bg-secondary border border-border rounded-2xl text-center">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
            Noch Fragen?
          </h2>
          <p className="text-text-muted mb-6 text-sm">
            Schreibe uns an cinegenius.co@gmail.com. Nenne den betroffenen Bereich und füge bei Fehlern möglichst den Seitenlink hinzu.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:cinegenius.co@gmail.com"
              className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
            >
              <Mail size={15} /> E-Mail Support
            </a>
            <Link
              href="/dashboard"
              className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare size={15} /> Mein Bereich
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
