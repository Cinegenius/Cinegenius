import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
