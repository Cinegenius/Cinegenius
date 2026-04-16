import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import GlobalEffects from "@/components/GlobalEffects";
import { ToastProvider } from "@/contexts/ToastContext";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cinegenius.com"),
  title: {
    default: "CineGenius — Marktplatz für Film, Social Media & Fotografie",
    template: "%s | CineGenius",
  },
  description:
    "Drehorte mieten, Filmcrew buchen, Equipment leihen, Jobs finden — der All-in-One-Marktplatz für Film- und Medienproduktion in Deutschland, Österreich und der Schweiz.",
  keywords: [
    "Drehorte mieten", "Filmcrew buchen", "Film Jobs Deutschland", "Requisiten mieten",
    "Equipment Verleih Film", "Filmproduktion DACH", "Content Creator buchen", "Fotograf buchen",
  ],
  authors: [{ name: "CineGenius" }],
  creator: "CineGenius",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "CineGenius",
    title: "CineGenius — Marktplatz für Film, Social Media & Fotografie",
    description:
      "Drehorte, Crew, Equipment und Jobs — alles für deine Produktion an einem Ort.",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "CineGenius" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CineGenius — Film & Medien Marktplatz",
    description: "Drehorte mieten, Crew buchen, Equipment leihen — für Film, Social Media & Fotografie.",
    images: ["/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signUpForceRedirectUrl="/profile-setup"
      signInFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="de"
        data-theme="dark"
        suppressHydrationWarning
        className={`${playfair.variable} ${inter.variable} ${jetbrains.variable}`}
      >
        <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary font-sans">
          <ThemeProvider>
            <ToastProvider>
              <GlobalEffects />
              <Navbar />
              <main className="flex-1 pb-14 lg:pb-0">{children}</main>
              <Footer />
              <BottomNav />
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
