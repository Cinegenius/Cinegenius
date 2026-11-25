import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MemberEntry from "@/components/MemberEntry";
import { getAuthSwitchDestination, getSignUpSetupDestination, safeAuthRedirect } from "@/lib/auth-redirect";

type SearchParams = Promise<{
  redirect_url?: string | string[];
  redirect?: string | string[];
}>;

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ userId }, query] = await Promise.all([auth(), searchParams]);
  const destination = safeAuthRedirect(query.redirect_url ?? query.redirect, "/", ["/sign-in", "/sign-up"]);
  if (userId) redirect(destination);

  const afterSignUp = getSignUpSetupDestination(destination);

  return <MemberEntry mode="sign-up" destination={afterSignUp} switchDestination={getAuthSwitchDestination("sign-in", destination)} />;
}
