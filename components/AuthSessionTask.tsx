"use client";

import { RedirectToTasks, TaskChooseOrganization, TaskResetPassword, TaskSetupMFA, useSession } from "@clerk/nextjs";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import AuthFormLoading from "@/components/AuthFormLoading";
import { getAuthSwitchDestination } from "@/lib/auth-redirect";
import type { AuthSessionTaskKey } from "@/lib/auth-session-tasks";

const appearance = {
  variables: {
    colorPrimary: "var(--color-gold)",
    colorBackground: "var(--color-bg-primary)",
    colorText: "var(--color-text-primary)",
    colorTextSecondary: "var(--color-text-secondary)",
    colorInputBackground: "var(--color-bg-secondary)",
    colorInputText: "var(--color-text-primary)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-dm-sans), sans-serif",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none" },
    card: { backgroundColor: "transparent", boxShadow: "none" },
    formFieldInput: { minHeight: "48px" },
    formButtonPrimary: { minHeight: "48px", color: "var(--color-bg-primary)" },
    footer: { backgroundColor: "transparent" },
  },
} as const;

/** Resume an interrupted security task without granting a pending session app access. */
export function AuthSessionTaskGate({ children }: { children: ReactNode }) {
  const { isLoaded, session } = useSession();
  if (isLoaded && session?.currentTask) return <><RedirectToTasks /><AuthFormLoading /></>;
  return children;
}

/** Clerk owns verification and password updates; this component grants no app access. */
export default function AuthSessionTask({ task, destination }: { task: AuthSessionTaskKey; destination: string }) {
  const t = useTranslations("auth");
  const { isLoaded, session } = useSession();
  if (!isLoaded) return <AuthFormLoading />;
  if (session?.currentTask && session.currentTask.key !== task) return <><RedirectToTasks /><AuthFormLoading /></>;
  if (session?.currentTask?.key === task) {
    const props = { redirectUrlComplete: destination, appearance };
    if (task === "reset-password") return <TaskResetPassword {...props} />;
    if (task === "setup-mfa") return <TaskSetupMFA {...props} />;
    return <TaskChooseOrganization {...props} />;
  }
  return <div className="space-y-4">
    <p role="status" className="text-sm leading-relaxed text-text-secondary">{t("sessionTaskUnavailable")}</p>
    <Link href={getAuthSwitchDestination("sign-in", destination)} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-5 text-base font-bold text-bg-primary hover:bg-gold-light">{t("backSignIn")}</Link>
  </div>;
}
