import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CompanyMemberInvitations } from "@/components/CompanyMemberInvitations";
export const dynamic = "force-dynamic";
export const metadata = { title: "Teameinladungen | CineGenius", robots: { index: false, follow: false } };
export default async function CompanyInvitationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Fcompany-invitations");
  return <main className="site-container min-h-screen pb-28 pt-28"><h1 className="mb-4 font-display text-3xl text-text-primary">Firmenzugehörigkeiten</h1><p className="mb-6 max-w-2xl text-sm text-text-muted">Hier kannst du die dir angebotenen Firmenzugehörigkeiten annehmen oder ablehnen. Erst deine Annahme macht eine Einladung öffentlich. Öffentliche Funktionen und technische Rechte bleiben getrennt.</p><CompanyMemberInvitations mode="received" /></main>;
}
