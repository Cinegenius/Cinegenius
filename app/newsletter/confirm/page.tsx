import { NewsletterAction } from "@/components/NewsletterAction";

export const dynamic = "force-dynamic";

export default async function NewsletterConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <NewsletterAction mode="confirm" token={token} />;
}
