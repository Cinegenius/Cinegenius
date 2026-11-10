import {getTranslations} from "next-intl/server";
import Link from "next/link";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/agb" },
  title: tMetadata('m_ef0fe873bb68'),
  description: tMetadata('m_571a8f0d6386'),
};
}

export default async function AgbPage() {
  const uiText = await getTranslations();

  const t = await getTranslations("LegalAuditOriginal");
  return (
    <div className="pt-16 min-h-screen min-w-0 bg-bg-primary [overflow-wrap:anywhere]">
      <div className="max-w-2xl mx-auto px-4 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{uiText("Ui.text_0da5374b4c42ae")}</p>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">{uiText("Ui.text_986664fa33f063")}</h1>
          <p className="text-text-muted text-sm">{t("termsDate")}</p>
        </div>

        <div className="space-y-8 text-text-secondary">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_75cfed8707d5a4")}</h2>
            <p className="text-sm leading-relaxed">
              {t("scope")}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_efefc4a4e44b8e")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_0c2a10760b425a")}</p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>{uiText("Ui.text_cb1458dec42d26")}</li>
              <li>{uiText("Ui.text_83642460f8953a")}</li>
              <li>{uiText("Ui.text_a5863fa618b97a")}</li>
              <li>{uiText("Ui.text_a2861e9e3826ab")}</li>
              <li>{uiText("Ui.text_c911fdb867803c")}</li>
              <li>{uiText("Ui.text_c0ad3b67db7dd2")}</li>
              <li>{uiText("Ui.text_2d4a75ee44120d")}</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_8ffc0e76e2cdff")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_21e1f78910c1a4")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_3c07e7b489db3e")}</p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>{uiText("Ui.text_b062f0b7359084")}</li>
              <li>{uiText("Ui.text_fe0538107d6bbf")}</li>
              <li>{uiText("Ui.text_5f03f26809de66")}</li>
              <li>{uiText("Ui.text_b687081568ffcb")}</li>
              <li>{uiText("Ui.text_208486955f3b5e")}</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_14bd9e25719924")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_6965ce58696e92")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_c4a11bfaf9ca81")}</p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>{uiText("Ui.text_71d41e7c11a3ee")}</li>
              <li>{uiText("Ui.text_1dabb996735a32")}</li>
              <li>{uiText("Ui.text_37a7351619861e")}</li>
              <li>{uiText("Ui.text_66bdb4e114b9cd")}</li>
              <li>{uiText("Ui.text_33bbb350c63200")}</li>
              <li>{uiText("Ui.text_d8d9366ed5b49a")}</li>
              <li>{uiText("Ui.text_30df77c4b36847")}</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_d2f07788d23e30")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_660d5dacff98b2")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_0c4305ac1251dc")}</p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>{uiText("Ui.text_41b563f1ce43d8")}</li>
              <li>{uiText("Ui.text_b3b46918fc83de")}</li>
              <li>{uiText("Ui.text_84c82b189d332b")}</li>
              <li>{uiText("Ui.text_0f058ff9267c58")}</li>
              <li>{uiText("Ui.text_1e4dcfe5ea81d9")}</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_60394a6e86b208")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_487f273bffb92c")}</h2>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_d1c77181f5535a")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_abe5b8678ae610")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_112fd2920ee6c6")}</h2>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_0cca91f33c7540")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_fdd26c97b27f40")}</h2>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_56629f661776e0")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_12bf554568f2f6")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_28b5c1d709b192")}</h2>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_3922d88995bea7")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_88375637c94265")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_77e10b4955bef9")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_f71db5c2740829")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_f030f0de2252ed")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_a024d03e321693")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_60917621997fcf")}</p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>{uiText("Ui.text_db6c12b5374f0e")}</li>
              <li>{uiText("Ui.text_03b157b63691b9")}</li>
              <li>{uiText("Ui.text_cf5384134a6954")}</li>
              <li>{uiText("Ui.text_068423e631b794")}</li>
              <li>{uiText("Ui.text_0fcef570ddec50")}</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_6c1093b8e2e60d")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_78c4ba6e0dc10d")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_f038ba765b8b25")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_f5315cb707d7cd")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_5c5e16ac6fa0f5")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_49442663ee1e7b")}</h2>
            <p className="text-sm leading-relaxed">{uiText.rich("Ui.text_b96e50a60df1cc", { part1: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>) })}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_ca14a695232c3b")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_f97f494f842b6b")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_d1e5e968645eeb")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_97250dbcf721d5")}</p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>{uiText("Ui.text_aaa431ed35068f")}</li>
              <li>{uiText("Ui.text_37044a81b2d04e")}</li>
              <li>{uiText("Ui.text_e207c53574237d")}</li>
              <li>{uiText("Ui.text_0602d7128674a3")}</li>
            </ul>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_5ba1b978df9cbd")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_f2d4afee42b880")}</h2>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_84e4e3f5b48399")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_1d893ae3d54b73")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_9d9a4ef387cc81")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_5d4732bad385f1")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_5b96dd58ef3f64")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_11db3fe91a9013")}</p>
            <p className="text-sm leading-relaxed mt-3">{uiText("Ui.text_29a55ace44c843")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">{uiText("Ui.text_078b6d7f2dbdde")}</h2>
            <p className="text-sm leading-relaxed">{uiText("Ui.text_92160916c9d164")}</p>
            <div className="mt-3 text-sm leading-relaxed bg-bg-elevated rounded-lg p-4 space-y-1">
              <p className="font-medium text-text-primary">{uiText("Ui.text_9caa74787b1567")}</p>
              <p>{uiText("Ui.text_05310b88e6fcc0")}</p>
              <p>{uiText.rich("Ui.text_c4c264ee568fd4", { part1: chunks => (<a href="mailto:cinegenius.co@gmail.com" className="text-gold hover:underline">{chunks}</a>) })}</p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-6">{uiText.rich("Ui.text_f33d128c1aa488", { part1: chunks => (<Link href="/impressum" className="text-sm text-gold hover:underline">{chunks}</Link>), part2: chunks => (<Link href="/datenschutz" className="text-sm text-gold hover:underline">{chunks}</Link>) })}</div>

      </div>
    </div>
  );
}
