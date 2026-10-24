import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getAuthSwitchDestination, getSignUpSetupDestination, safeAuthRedirect } from "@/lib/auth-redirect";

type SearchParams = Promise<{
  redirect_url?: string | string[];
  redirect?: string | string[];
}>;

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ userId }, query] = await Promise.all([auth(), searchParams]);
  const destination = safeAuthRedirect(query.redirect_url ?? query.redirect, "/dashboard", ["/sign-in", "/sign-up"]);
  if (userId) redirect(destination);

  const afterSignUp = getSignUpSetupDestination(destination);

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Kostenlos starten</p>
          <h1 className="font-display text-3xl font-bold text-text-primary">Konto erstellen</h1>
        </div>
        <AuthForm
          mode="sign-up"
          destination={afterSignUp}
          signInDestination={getAuthSwitchDestination("sign-in", destination)}
        />
      </div>
    </div>
  );
}
