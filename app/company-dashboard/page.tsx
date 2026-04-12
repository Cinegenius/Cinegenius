import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
const admin = supabaseAdmin;
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("owner_user_id", userId)
    .single();

  if (!company) redirect("/company-setup");

  return <DashboardClient company={company} />;
}
