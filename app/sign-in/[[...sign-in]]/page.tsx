import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MemberEntry from "@/components/MemberEntry";
import { getAuthSwitchDestination, safeAuthRedirect } from "@/lib/auth-redirect";

type SearchParams = Promise<{
  redirect_url?: string | string[];
  redirect?: string | string[];
}>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ userId }, query] = await Promise.all([auth(), searchParams]);
  const destination = safeAuthRedirect(query.redirect_url ?? query.redirect, "/", ["/sign-in", "/sign-up"]);
  if (userId) redirect(destination);

  return <MemberEntry mode="sign-in" destination={destination} switchDestination={getAuthSwitchDestination("sign-up", destination)} />;
}
