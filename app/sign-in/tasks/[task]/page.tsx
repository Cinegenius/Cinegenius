import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import AuthSessionTask from "@/components/AuthSessionTask";
import { getAuthSwitchDestination, safeAuthRedirect } from "@/lib/auth-redirect";
import { isAuthSessionTaskKey } from "@/lib/auth-session-tasks";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ task: string }>;
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function AuthSessionTaskPage({ params, searchParams }: Props) {
  const [{ task }, query, identity, t] = await Promise.all([
    params, searchParams, auth({ treatPendingAsSignedOut: false }), getTranslations("auth"),
  ]);
  if (!isAuthSessionTaskKey(task)) notFound();
  const destination = safeAuthRedirect(query.redirect_url, "/dashboard", ["/sign-in", "/sign-up"]);
  if (!identity.userId) redirect(getAuthSwitchDestination("sign-in", destination));
  if (identity.sessionStatus === "active") redirect(destination);
  return <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4 pb-8 pt-24">
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-bold text-text-primary">{t("sessionTaskTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{t("sessionTaskDescription")}</p>
      </div>
      <AuthSessionTask task={task} destination={destination} />
    </div>
  </div>;
}
