import { createHash } from "node:crypto";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import CompanyInvitationAccept from "./CompanyInvitationAccept";
import { useTranslations } from "next-intl";

import { getTranslations } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return { title: tMetadata('m_2cfa48ed41ee'), robots: { index: false, follow: false } };
}

export default async function CompanyInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const uiText = await getTranslations();

  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return <InvitationMessage title={uiText("Ui.text_550fe75471bfa1")} message={uiText("PageCopy.invitationUsed")} />;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: invitation } = await db.from("company_invitations")
    .select("company_id, permission_role, status, expires_at")
    .eq("token_hash", hash).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!invitation) return <InvitationMessage title={uiText("Ui.text_550fe75471bfa1")} message={uiText("PageCopy.invitationExpired")} />;
  const { data: company } = await db.from("companies").select("id, name, slug, logo_url").eq("id", invitation.company_id).maybeSingle();
  if (!company) return <InvitationMessage title={uiText("Ui.text_42aa6c83f58a06")} message={uiText("PageCopy.companyUnavailable")} />;
  const { userId } = await auth();

  return (
    <main className="min-h-[calc(100vh-64px)] bg-bg-primary px-4 py-12 text-text-primary">
      <section className="mx-auto max-w-lg rounded-2xl border border-border bg-bg-secondary p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">{uiText("Ui.text_ce9f037e95fc52")}</p>
        <h1 className="mt-3 font-display text-2xl">{uiText.rich("Ui.text_3f9a33ef93cf42", { value1: () => (company.name) })}</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">{uiText("Ui.text_71999dc9ef80ed")}</p>
        {userId ? <CompanyInvitationAccept token={token} companyName={company.name} /> : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{uiText.rich("Ui.text_486e60617e596c", { part1: chunks => (<Link href={`/sign-in?redirect_url=${encodeURIComponent(`/company-invitations/${token}`)}`} className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-text-primary">{chunks}</Link>), part2: chunks => (<Link href={`/sign-up?redirect_url=${encodeURIComponent(`/company-invitations/${token}`)}`} className="flex min-h-12 items-center justify-center rounded-xl bg-gold px-4 text-sm font-bold text-bg-primary">{chunks}</Link>) })}</div>
        )}
      </section>
    </main>
  );
}

function InvitationMessage({ title, message }: { title: string; message: string }) {
  const uiText = useTranslations();

  return <main className="min-h-[calc(100vh-64px)] bg-bg-primary px-4 py-12 text-text-primary"><section className="mx-auto max-w-lg rounded-2xl border border-border bg-bg-secondary p-6"><h1 className="font-display text-2xl">{title}</h1><p className="mt-3 text-sm text-text-secondary">{message}</p><Link href="/companies" className="mt-6 inline-flex min-h-11 items-center text-sm text-gold">{uiText("Ui.text_7ea82e3b262e56")}</Link></section></main>;
}
