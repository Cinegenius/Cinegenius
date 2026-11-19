"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bell, ChevronDown, ChevronRight, ShieldCheck, Trash2, Wallet, type LucideIcon } from "lucide-react";
import PrivacySettings from "@/components/PrivacySettings";
import NotificationPreferences from "@/components/NotificationPreferences";
import NativePushSettings from "@/components/app/NativePushSettings";

type Props = { accountId: string | null; verification?: ReactNode; dangerZone?: ReactNode };
const SETTING_SECTIONS = ["security", "privacy", "notifications", "verification", "delete"] as const;
type SettingsSection = typeof SETTING_SECTIONS[number];

function settingsSection(value: string | null): SettingsSection | null {
  return SETTING_SECTIONS.includes(value as SettingsSection) ? value as SettingsSection : null;
}

export default function PersonalSettings({ accountId, verification, dangerZone }: Props) {
  const t = useTranslations();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const searchParams = useSearchParams();
  const requestedSection = settingsSection(searchParams.get("section"));
  const [openSection, setOpenSection] = useState<SettingsSection | null>(requestedSection);
  const regionId = useId();
  const activeAccount = isLoaded && isSignedIn && userId === accountId && user?.id === accountId ? accountId : null;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setOpenSection(requestedSection); });
    return () => { active = false; };
  }, [requestedSection, activeAccount]);

  useEffect(() => {
    if (openSection && requestedSection === openSection) document.getElementById(`${regionId}-${openSection}`)?.scrollIntoView({ block: "nearest" });
  }, [openSection, requestedSection, regionId]);

  if (!activeAccount) return <p role="status" className="py-4 text-sm text-text-muted">{t(isLoaded && userLoaded ? "PrivacySettings.unavailable" : "PrivacySettings.loading")}</p>;

  const group = (id: SettingsSection, label: string, Icon: LucideIcon, content: ReactNode, danger = false) => (
    <section key={`${activeAccount}:${id}`} id={`${regionId}-${id}`} className="scroll-mt-[calc(var(--site-header-height)+5rem)] border-b border-border last:border-b-0">
      <button type="button" id={`${regionId}-${id}-label`} aria-expanded={openSection === id} aria-controls={`${regionId}-${id}-content`}
        onClick={() => setOpenSection(current => current === id ? null : id)}
        className={`flex min-h-16 w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-bg-hover sm:px-5 ${danger ? "text-red-400" : "text-text-primary"}`}>
        <Icon size={19} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 break-words text-sm font-medium">{label}</span><ChevronDown size={16} className={`shrink-0 text-text-muted transition-transform ${openSection === id ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={`${regionId}-${id}-content`} role="region" aria-labelledby={`${regionId}-${id}-label`} hidden={openSection !== id} className="min-w-0 border-t border-border px-4 py-4 sm:px-5">{openSection === id ? content : null}</div>
    </section>
  );

  return <div className="min-w-0 max-w-2xl space-y-5">
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-secondary">
      {group("security", t("nav.securityAndSignIn"), ShieldCheck, <div className="space-y-4">
        <div><p className="text-xs text-text-muted">{t("profile.fieldEmail")}</p><p className="mt-1 break-words text-sm text-text-primary [overflow-wrap:anywhere]">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p></div>
        <button type="button" onClick={() => openUserProfile()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover">{t("nav.accountSettings")}<ChevronRight size={16} aria-hidden="true" /></button>
      </div>)}
      {group("privacy", t("PrivacySettings.title"), ShieldCheck, <PrivacySettings accountId={activeAccount} showEmailPreference={false} embedded />)}
      {group("notifications", t("nav.notifications"), Bell, <div className="space-y-4"><NativePushSettings /><NotificationPreferences accountId={activeAccount} /></div>)}
      <Link href="/invoices" className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover sm:px-5"><Wallet size={19} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{t("nav.payments")}</span><ChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden="true" /></Link>
      {verification && group("verification", t("profile.tabVerification"), ShieldCheck, <div className="space-y-4">{verification}<Link href="/profile?tab=verification" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg-hover">{t("profile.verifIdLabel")}<ChevronRight size={16} aria-hidden="true" /></Link></div>)}
    </div>
    {dangerZone && <div className="overflow-hidden rounded-2xl border border-border bg-bg-secondary">{group("delete", t("Ui.text_73fc53cbf7c175"), Trash2, dangerZone, true)}</div>}
  </div>;
}
