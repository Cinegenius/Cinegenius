import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suche",
  description: "Locations, Filmcrew, Equipment, Jobs und Firmen auf CineGenius durchsuchen — alles für deine Film- oder Medienproduktion.",
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
