import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/requireAdmin";

/**
 * Server-side layout guard for all /admin pages.
 * The middleware.ts already blocks non-admins before this runs,
 * but this acts as a defence-in-depth second layer.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdminSession();
  if (!admin) redirect("/");
  return <>{children}</>;
}
