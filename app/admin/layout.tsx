import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId || !ADMIN_IDS.includes(userId)) {
    redirect("/");
  }
  return <>{children}</>;
}
