import { NewsletterAction } from "@/components/NewsletterAction";

export const dynamic = "force-dynamic";

export default async function NewsletterUnsubscribePage({ searchParams }: { searchParams: Promise<{ id?: string; proof?: string }> }) {
  const { id, proof } = await searchParams;
  return <NewsletterAction mode="unsubscribe" id={id} proof={proof} />;
}
