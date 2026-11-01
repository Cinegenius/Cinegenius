"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { hasProfileBasics } from "@/lib/profile-setup-flow";
import { providerProfileEntry } from "@/lib/provider-profile-setup";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import { getSetupReminder, type SetupReminder } from "@/lib/setup-reminder";

export default function SetupStatusNotice() {
  const { user } = useUser();
  const provider = useTranslations("ProviderSetup");
  const [resolved, setResolved] = useState<{ userId: string; reminder: SetupReminder | null; providerHref: string | null } | null>(null);
  const reminder = resolved?.userId === user?.id ? resolved?.reminder : null;
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    Promise.all([fetch("/api/profile", { cache: "no-store" }), fetch("/api/onboarding", { cache: "no-store" })])
      .then(async ([profile, setup]) => {
        if (!profile.ok || !setup.ok) return;
        const [profileBody, setupBody] = await Promise.all([profile.json(), setup.json()]);
        if (active) setResolved({ userId: user.id, reminder: getSetupReminder(profileBody.exists === true, setupBody.draft), providerHref: providerProfileEntry(hasProfileBasics(profileBody.profile), setupBody.draft) });
      }).catch(() => { /* Unknown state must not be presented as an unpublished profile. */ });
    return () => { active = false; };
  }, [user?.id]);
  if (!reminder && resolved?.userId === user?.id && resolved?.providerHref) return <section className="rounded-xl border border-border bg-bg-secondary p-4"><h2 className="text-sm font-semibold text-text-primary">{provider("title")}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{provider("entry")}</p><Link href={resolved.providerHref} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm text-gold">{provider("create")}<ArrowRight size={15} /></Link></section>;
  if (!reminder) return null;
  return <section className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
    <div className="flex items-start gap-3"><EyeOff size={20} className="mt-0.5 shrink-0 text-gold" /><div className="min-w-0"><h2 className="text-base font-semibold leading-snug text-text-primary">{reminder.title}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{reminder.description}</p></div></div>
    <Link href={reminder.href} className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Jetzt vervollständigen<ArrowRight size={16} /></Link>
  </section>;
}
