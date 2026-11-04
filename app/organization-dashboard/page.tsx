import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { accountResponsiblePerson } from "@/lib/responsible-person-server";
import { organizationWorkspace } from "@/lib/organization-data";
import OrganizationDashboardClient from "@/components/organizations/OrganizationDashboardClient";

export const dynamic = "force-dynamic";

export default async function OrganizationDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Forganization-dashboard");
  const [workspace, responsiblePerson] = await Promise.all([
    organizationWorkspace(userId),
    accountResponsiblePerson(userId),
  ]);
  return <OrganizationDashboardClient initialWorkspace={workspace} responsiblePerson={responsiblePerson} />;
}
