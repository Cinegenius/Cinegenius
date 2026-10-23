import { createHash } from "node:crypto";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import CompanyInvitationAccept from "./CompanyInvitationAccept";

export const dynamic = "force-dynamic";
export const metadata = { title: "CineGenius Team-Einladung", robots: { index: false, follow: false } };

export default async function CompanyInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return <InvitationMessage title="Einladung nicht verfügbar" message="Dieser Einladungslink ist ungültig oder wurde bereits verwendet." />;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: invitation } = await db.from("company_invitations")
    .select("company_id, permission_role, status, expires_at")
    .eq("token_hash", hash).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!invitation) return <InvitationMessage title="Einladung nicht verfügbar" message="Dieser Einladungslink ist ungültig, wurde schon verwendet oder ist abgelaufen." />;
  const { data: company } = await db.from("companies").select("id, name, slug, logo_url").eq("id", invitation.company_id).maybeSingle();
  if (!company) return <InvitationMessage title="Firma nicht verfügbar" message="Diese Firma ist nicht mehr verfügbar." />;
  const { userId } = await auth();

  return (
    <main className="min-h-[calc(100vh-64px)] bg-bg-primary px-4 py-12 text-text-primary">
      <section className="mx-auto max-w-lg rounded-2xl border border-border bg-bg-secondary p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">CineGenius · Teameinladung</p>
        <h1 className="mt-3 font-display text-2xl">Einladung zu {company.name}</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">Wenn du fortfährst, wird deine Zugehörigkeit zunächst der Firma zur Bestätigung vorgelegt. Deine öffentliche Funktion wird erst nach der Freigabe angezeigt.</p>
        {userId ? <CompanyInvitationAccept token={token} companyName={company.name} /> : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/company-invitations/${token}`)}`} className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-text-primary">Anmelden</Link>
            <Link href={`/sign-up?redirect_url=${encodeURIComponent(`/company-invitations/${token}`)}`} className="flex min-h-12 items-center justify-center rounded-xl bg-gold px-4 text-sm font-bold text-bg-primary">Konto erstellen</Link>
          </div>
        )}
      </section>
    </main>
  );
}

function InvitationMessage({ title, message }: { title: string; message: string }) {
  return <main className="min-h-[calc(100vh-64px)] bg-bg-primary px-4 py-12 text-text-primary"><section className="mx-auto max-w-lg rounded-2xl border border-border bg-bg-secondary p-6"><h1 className="font-display text-2xl">{title}</h1><p className="mt-3 text-sm text-text-secondary">{message}</p><Link href="/companies" className="mt-6 inline-flex min-h-11 items-center text-sm text-gold">Firmen entdecken →</Link></section></main>;
}
