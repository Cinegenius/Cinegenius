import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { ContentTranslationProvider } from "@/components/ContentTranslation";
import { auth } from "@clerk/nextjs/server";
import { deDE, enUS, esES, csCZ, huHU, itIT, nlNL, nlBE, svSE, frFR, plPL, ptPT, zhCN, jaJP, koKR, ruRU, ukUA } from "@clerk/localizations";
import AppIntlProvider from "@/components/AppIntlProvider";
import { getLocale, getMessages, getNow, getTimeZone, getTranslations } from "next-intl/server";
import { clientMessages } from "@/lib/i18n/client-messages";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { isConfiguredAdmin } from "@/lib/admin-policy";
import { ThemeProvider } from "@/components/ThemeProvider";
import GlobalEffects from "@/components/GlobalEffects";
import PresencePing from "@/components/PresencePing";
import CookieBanner from "@/components/CookieBanner";
import ProductAnalytics from "@/components/ProductAnalytics";
import { ToastProvider } from "@/contexts/ToastContext";
import GlobalSearch from "@/components/GlobalSearch";
import FormDraftProvider from "@/contexts/FormDraftContext";
import AuthSessionBoundary from "@/components/AuthSessionBoundary";
import { AUTH_TASK_URLS } from "@/lib/auth-session-tasks";
import Genie from "@/components/Genie";
import { getTranslations as getMetadataTranslations } from "next-intl/server";
import { CINEGENIUS_MAINTENANCE_MODE } from "@/lib/maintenance-mode";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  preload: false,
  weight: ["400", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  preload: false,
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  preload: false,
  weight: ["400", "500"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables safe-area-inset on iPhone
};

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  const tMaintenance = await getMetadataTranslations("maintenance");
  const locale = await getLocale();
  if (CINEGENIUS_MAINTENANCE_MODE) {
    return {
      metadataBase: new URL("https://www.cinegenius.co"),
      title: tMaintenance("title"),
      description: tMaintenance("body"),
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false, noimageindex: true },
      },
    };
  }
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
    locale: ({de: "de_DE", en: "en_US", es: "es_ES", it: "it_IT", cs: "cs_CZ", hu: "hu_HU", nl: "nl_NL", "nl-BE": "nl_BE", sv: "sv_SE", fr: "fr_FR", pl: "pl_PL", "pt-PT": "pt_PT", "zh-Hans": "zh_CN", ja: "ja_JP", ko: "ko_KR", ru: "ru_RU", uk: "uk_UA"} as Record<string, string>)[locale] ?? "de_DE",
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
  sv: svSE, fr: frFR, pl: plPL, "pt-PT": ptPT, "zh-Hans": zhCN, ja: jaJP, ko: koKR, ru: ruRU, uk: ukUA,
};

const HTML_LANG: Record<string, string> = {
  de: "de", en: "en", es: "es", cs: "cs", hu: "hu", it: "it", nl: "nl", "nl-BE": "nl-BE", sv: "sv", fr: "fr", pl: "pl", "pt-PT": "pt-PT", "zh-Hans": "zh-Hans", ja: "ja", ko: "ko", ru: "ru", uk: "uk",
};

function MaintenancePage({ badge, title, body, contactPrefix }: { badge: string; title: string; body: string; contactPrefix: string }) {
  return (
    <main className="relative flex min-h-dvh items-center overflow-hidden bg-bg-primary px-4 py-10 text-text-primary sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(194,241,53,0.14),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(224,122,95,0.12),transparent_30%),linear-gradient(145deg,rgba(14,16,22,0.88),rgba(14,16,22,1))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-7 flex min-h-11 items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden className="h-7 w-7 shrink-0">
            <polyline points="5.5,4 18.5,12 5.5,20" stroke="var(--color-gold)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-sans text-lg leading-none"><span className="font-medium text-text-primary">Cine</span><span className="font-bold text-gold">Genius</span></span>
        </div>
        <p className="mb-4 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          {badge}
        </p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight text-text-primary sm:text-5xl md:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
          {body}
        </p>
        <p className="mt-8 text-sm leading-6 text-text-muted">
          {contactPrefix}{" "}
          <a className="font-semibold text-gold underline-offset-4 hover:underline" href="mailto:hello@cinegenius.co">
            hello@cinegenius.co
          </a>
        </p>
      </section>
    </main>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (CINEGENIUS_MAINTENANCE_MODE) {
    const [locale, tMaintenance] = await Promise.all([getLocale(), getTranslations("maintenance")]);
    const htmlLang = HTML_LANG[locale] ?? "de";

    return (
      <html
        lang={htmlLang}
        data-theme="dark"
        suppressHydrationWarning
        className={`${playfair.variable} ${dmSans.variable} ${jetbrains.variable}`}
      >
        <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary font-sans">
          <MaintenancePage
            badge={tMaintenance("badge")}
            title={tMaintenance("title")}
            body={tMaintenance("body")}
            contactPrefix={tMaintenance("contactPrefix")}
          />
        </body>
      </html>
    );
  }

  const [locale, messages, now, timeZone, { userId, sessionId }] = await Promise.all([getLocale(), getMessages(), getNow(), getTimeZone(), auth()]);
  const clerkLocalization = CLERK_LOCALIZATIONS[locale] ?? deDE;
  const originalContent = (await cookies()).get("cg_content_original")?.value === "1";
  const htmlLang = HTML_LANG[locale] ?? "de";

  return (
    <ClerkProvider
      dynamic
      localization={clerkLocalization}
      taskUrls={AUTH_TASK_URLS}
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
          <AppIntlProvider locale={locale} messages={clientMessages(messages)} now={now} timeZone={timeZone}>
          <ThemeProvider>
            <ToastProvider>
              <AuthSessionBoundary initialSessionId={sessionId}>
              <ContentTranslationProvider enabled={process.env.CONTENT_TRANSLATION_ENABLED === "true"} initialOriginal={originalContent} initialUserId={userId}>
              <FormDraftProvider>
                <GlobalEffects />
                <PresencePing />
                <GlobalSearch />
                <AppChrome initialIsSignedIn={!!userId} initialAdminUserId={isConfiguredAdmin(userId, process.env.ADMIN_USER_IDS) ? userId : null}>{children}</AppChrome>
                <CookieBanner />
                <ProductAnalytics />
                <Genie />
              </FormDraftProvider>
              </ContentTranslationProvider>
              </AuthSessionBoundary>
            </ToastProvider>
          </ThemeProvider>
          </AppIntlProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
