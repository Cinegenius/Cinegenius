import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAuthSwitchDestination, safeAuthRedirect } from "@/lib/auth-redirect";
import { LockKeyhole } from "lucide-react";
import AuthForm from "@/components/AuthForm";
import { AuthSessionTaskGate } from "@/components/AuthSessionTask";

export default async function MemberEntry({ mode, destination, switchDestination }: {
  mode: "sign-in" | "sign-up";
  destination: string;
  switchDestination: string;
}) {
  const [t, auth] = await Promise.all([getTranslations("memberEntry"), getTranslations("auth")]);
  const returnTo = mode === "sign-in" ? destination : safeAuthRedirect(new URL(switchDestination, "https://www.cinegenius.co").searchParams.get("redirect_url") ?? undefined, "/");
  return (
    <section className="mx-auto w-full max-w-lg px-4 pb-8 pt-24 sm:pt-28">
      <div className="mb-6 text-center">
        <LockKeyhole className="mx-auto mb-4 text-gold" size={26} aria-hidden="true" />
        <h1 className="break-words [overflow-wrap:anywhere] font-display text-3xl font-bold leading-tight text-text-primary">{t("title")}</h1>
        <p className="mt-4 text-sm leading-6 text-text-secondary sm:text-base">{t("description")}</p>
      </div>
      <div className="rounded-2xl border border-border bg-bg-primary/95 p-4 shadow-xl sm:p-6">
        <nav aria-label={t("accessLabel")} className="mb-6 grid grid-cols-2 gap-2">
          <Link prefetch href={mode === "sign-in" ? getAuthSwitchDestination("sign-in", returnTo) : switchDestination} aria-current={mode === "sign-in" ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold ${mode === "sign-in" ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-secondary"}`}>
            {auth("signIn")}
          </Link>
          <Link prefetch href={mode === "sign-up" ? getAuthSwitchDestination("sign-up", returnTo) : switchDestination} aria-current={mode === "sign-up" ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold ${mode === "sign-up" ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-secondary"}`}>
            {auth("createAccount")}
          </Link>
        </nav>
        <AuthSessionTaskGate>
          <AuthForm mode={mode} destination={destination}
            signUpDestination={mode === "sign-in" ? switchDestination : undefined}
            signInDestination={mode === "sign-up" ? switchDestination : undefined} />
        </AuthSessionTaskGate>
      </div>
    </section>
  );
}
