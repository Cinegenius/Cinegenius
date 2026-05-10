import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rechnungen",
  robots: { index: false, follow: false },
};

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
