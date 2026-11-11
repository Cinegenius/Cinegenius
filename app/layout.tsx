import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { deDE, enUS, esES, csCZ, huHU, itIT, nlNL, nlBE, svSE } from "@clerk/localizations";
import AppIntlProvider from "@/components/AppIntlProvider";
import { getLocale, getMessages, getNow } from "next-intl/server";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { isConfiguredAdmin } from "@/lib/admin-policy";
import { ThemeProvider } from "@/components/ThemeProvider";
import GlobalEffects from "@/components/GlobalEffects";
import PresencePing from "@/components/PresencePing";
import CookieBanner from "@/components/CookieBanner";
import { ToastProvider } from "@/contexts/ToastContext";
import GlobalSearch from "@/components/GlobalSearch";
import FormDraftProvider from "@/contexts/FormDraftContext";
import AuthSessionBoundary from "@/components/AuthSessionBoundary";
import Genie from "@/components/Genie";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables safe-area-inset on iPhone
};

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  const locale = await getLocale();
  return {
  metadataBase: new URL("https://www.cinegenius.co"),
  title: {
    default: tMetadata('m_4cae16b2a04c'),
    template: "%s | CineGenius",
  },
  description:
    tMetadata('m_8bd0d66c1893'),
  keywords: [
    tMetadata('m_c6bc07f7fe22'), tMetadata('m_e54dabc25ec8'), tMetadata('m_debd69fc6894'), tMetadata('m_cb9a7dde6c1c'),
    tMetadata('m_0d4b52ff023b'), tMetadata('m_54488a9b48ad'), tMetadata('m_ac88802c1689'), tMetadata('m_0cc63a71479c'),
  ],
  authors: [{ name: "CineGenius" }],
  creator: "CineGenius",
  openGraph: {
    type: "website",
    locale: ({de: "de_DE", en: "en_US", es: "es_ES", it: "it_IT", cs: "cs_CZ", hu: "hu_HU", nl: "nl_NL", "nl-BE": "nl_BE", sv: "sv_SE"} as Record<string, string>)[locale] ?? "de_DE",
    siteName: "CineGenius",
    title: tMetadata('m_4cae16b2a04c'),
    description:
      tMetadata('m_275dcce7785e'),
  },
  twitter: {
    card: "summary_large_image",
    title: tMetadata('m_61b023da916f'),
    description: tMetadata('m_f835a883a82e'),
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};
}

const CLERK_LOCALIZATIONS: Record<string, typeof deDE> = {
  de: deDE,
  en: enUS,
  es: esES,
  cs: csCZ,
  hu: huHU,
  it: itIT,
  nl: nlNL,
  "nl-BE": nlBE,
  sv: svSE,
};

const HTML_LANG: Record<string, string> = {
  de: "de", en: "en", es: "es", cs: "cs", hu: "hu", it: "it", nl: "nl", "nl-BE": "nl-BE", sv: "sv",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, now, { userId, sessionId }] = await Promise.all([getLocale(), getMessages(), getNow(), auth()]);
  const clerkLocalization = CLERK_LOCALIZATIONS[locale] ?? deDE;
  const htmlLang = HTML_LANG[locale] ?? "de";

  return (
    <ClerkProvider
      dynamic
      localization={clerkLocalization}
      signUpForceRedirectUrl="/profile-setup?welcome=1"
      signInFallbackRedirectUrl="/dashboard"
      afterMultiSessionSingleSignOutUrl="/"
    >
      <html
        lang={htmlLang}
        data-theme="dark"
        suppressHydrationWarning
        className={`${playfair.variable} ${dmSans.variable} ${jetbrains.variable}`}
      >
        <head>
          {/* Clerk JS loads from these domains — early connection cuts auth init time */}
          <link rel="preconnect" href="https://clerk.cinegenius.co" />
          <link rel="preconnect" href="https://img.clerk.com" />
          <link rel="dns-prefetch" href="https://clerk.cinegenius.co" />
          <link rel="dns-prefetch" href="https://clerk.com" />
        </head>
        <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary font-sans">
          <AppIntlProvider locale={locale} messages={messages} now={now}>
          <ThemeProvider>
            <ToastProvider>
              <AuthSessionBoundary initialSessionId={sessionId}>
              <FormDraftProvider>
                <GlobalEffects />
                <PresencePing />
                <GlobalSearch />
                <AppChrome initialIsSignedIn={!!userId} initialAdminUserId={isConfiguredAdmin(userId, process.env.ADMIN_USER_IDS) ? userId : null}>{children}</AppChrome>
                <CookieBanner />
                <Genie />
                <Analytics />
                <SpeedInsights />
              </FormDraftProvider>
              </AuthSessionBoundary>
            </ToastProvider>
          </ThemeProvider>
          </AppIntlProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
