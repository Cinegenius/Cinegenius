import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { safeAuthRedirect } from "@/lib/auth-redirect";

type SearchParams = Promise<{
  redirect_url?: string | string[];
  redirect?: string | string[];
}>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ userId }, query] = await Promise.all([auth(), searchParams]);
  const destination = safeAuthRedirect(query.redirect_url ?? query.redirect, "/dashboard", ["/sign-in", "/sign-up"]);
  if (userId) redirect(destination);

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Willkommen zurück</p>
          <h1 className="font-display text-3xl font-bold text-text-primary">Anmelden</h1>
        </div>
        <AuthForm mode="sign-in" destination={destination} />
      </div>
    </div>
  );
}
