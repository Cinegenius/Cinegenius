import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/impressum" },
  title: tMetadata('m_b8a6051923e6'),
  description: tMetadata('m_a74cc1d108cd'),
};
}

export default function ImpressumPage() {
  const uiText = useTranslations();

  return (
    <div className="pt-16 min-h-screen min-w-0 bg-bg-primary [overflow-wrap:anywhere]">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{uiText("Ui.text_0da5374b4c42ae")}</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{uiText("footer.links_imprint")}</h1>
          <p className="text-text-muted text-sm">{uiText("Ui.text_71b1ce07420abf")}</p>
        </div>

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("profile.catAnbieterLabel")}</h2>
            <p className="text-sm leading-relaxed">{uiText.rich("Ui.text_59953c926d89a1", { part1: () => (<br />), part2: () => (<br />), part3: () => (<br />) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Organizations.contact")}</h2>
            <p className="text-sm leading-relaxed">{uiText.rich("Ui.text_8b69039703389c", { part1: chunks => (<a href="tel:+491713866624" className="text-gold hover:underline">{chunks}</a>), part2: () => (<br />), part3: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_392f82517d6087")}</h2>
            <p className="text-sm leading-relaxed">{uiText.rich("Ui.text_3a79768b0c5e34", { part1: () => (<br />), part2: () => (<br />) })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_0e0f042ca4ca20")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_6fb5eb1d0c3729")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_22e92ec30d50b7")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_d93309c5419122")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_34f4597f12bd1b")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_0e63af6cbe9e76")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_afdd5134162384")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_16ad6355c1b7ce")}</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-6">{uiText.rich("Ui.text_c49fae8449f318", { part1: chunks => (<Link href="/datenschutz" className="text-sm text-gold hover:underline">{chunks}</Link>), part2: chunks => (<Link href="/agb" className="text-sm text-gold hover:underline">{chunks}</Link>) })}</div>

      </div>
    </div>
  );
}
