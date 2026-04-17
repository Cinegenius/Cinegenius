/**
 * Injects a JSON-LD <script> tag for Google Rich Results.
 * Pass any valid Schema.org object as `data`.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
