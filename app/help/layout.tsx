import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.cinegenius.co/help" },
  title: "Hilfe & FAQ",
  description: "Häufige Fragen zu Buchungen, Profilen, Zahlungen und Sicherheit auf CineGenius — dem Marktplatz für Film, Social Media & Fotografie.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
