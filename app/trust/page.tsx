import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/trust" },
  title: tMetadata('m_40caf7cbe2d5'),
  description: tMetadata('m_cbe3f97a2369'),
};
}
import {
  Shield, CheckCircle, AlertCircle, RotateCcw, MessageSquare,
  ArrowRight, Lock, Eye, Flag,
} from "lucide-react";
import { getTranslations as getMetadataTranslations } from "next-intl/server";






function getLocalizedSections(translate: (key: string) => string) {
  return ([
  { icon: Lock, title: translate("Ui.text_b4c6e32be3effa"), id: "payment", content: [
    { heading: translate("Ui.text_3318a42e196547"), body: translate("Ui.text_240a0e90696973") },
    { heading: translate("Ui.text_deda6dfefccec7"), body: translate("Ui.text_ece2cd18994fed") },
    { heading: translate("Ui.text_92732943717035"), body: translate("Ui.text_0e024c5b72d5e2") },
  ] },
  { icon: RotateCcw, title: translate("Ui.text_06a219981769b1"), id: "cancellation", content: [
    { heading: translate("Ui.text_456b6149b52b2d"), body: translate("Ui.text_78970f62dbacb2") },
    { heading: translate("Ui.text_289fcfa7e3bce1"), body: translate("Ui.text_9304f320d20c7a") },
  ] },
  { icon: AlertCircle, title: translate("Ui.text_05db057884a227"), id: "disputes", content: [
    { heading: translate("Ui.text_14495a684f86ed"), body: translate("Ui.text_3550cab39bd557") },
    { heading: translate("Ui.text_598e3cb27810c9"), body: translate("Ui.text_a2170631ea5282") },
    { heading: translate("Ui.text_671024bb1d0a80"), body: translate("Ui.text_085da4a0443384") },
  ] },
  { icon: Eye, title: translate("Ui.text_b58e5dca3cf46a"), id: "verification", content: [
    { heading: translate("Ui.text_0dfdc58c21ba99"), body: translate("Ui.text_ebd7ef4c997d0f") },
    { heading: translate("Ui.text_530a7742f32181"), body: translate("Ui.text_05e9303570bd86") },
    { heading: translate("Ui.text_7420be84b1ad58"), body: translate("Ui.text_ce4dbaa5286d81") },
  ] },
]);
}


function getLocalizedQuickFacts(translate: (key: string) => string) {
  return ([
  { icon: MessageSquare, stat: translate("Organizations.contact"), label: translate("Ui.text_3b164ef8a00642") },
  { icon: Flag, stat: translate("Ui.text_a11f461624489e"), label: translate("Ui.text_d9905dccc98ae7") },
  { icon: Shield, stat: translate("Ui.text_661f7149b21eaa"), label: translate("Ui.text_606f909a615e60") },
  { icon: CheckCircle, stat: translate("Ui.text_5dfb5bcd667e78"), label: translate("Ui.text_4a473bb6be5bf4") },
]);
}

export default function TrustSafetyPage() {
  const uiText = useTranslations();
  const sections = getLocalizedSections(uiText);
  const quickFacts = getLocalizedQuickFacts(uiText);


  return (
    <div className="pt-16 min-h-screen">
      {/* Hero */}
      <div className="relative py-16 bg-bg-secondary border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-success/10 border border-success/20 rounded-full text-success text-xs font-medium mb-5">{uiText.rich("Ui.text_1833889cc1db39", { part1: () => (<Shield size={12} />) })}</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 leading-tight">{uiText("Ui.text_b77761df40bc7f")}</h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">{uiText("Ui.text_74d2dceff1cd99")}</p>
        </div>
      </div>

      {/* Quick Facts */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickFacts.map(({ icon: Icon, stat, label }) => (
            <div key={label} className="p-5 bg-bg-secondary border border-border rounded-xl text-center">
              <div className="w-10 h-10 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Icon size={18} className="text-success" />
              </div>
              <div className="font-display text-2xl font-bold text-text-primary mb-1">{stat}</div>
              <div className="text-xs text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex gap-10 flex-col lg:flex-row">

          {/* Sidebar nav */}
          <aside className="lg:w-56 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-3 mb-3">{uiText("Organizations.topics")}</p>
              {sections.map(({ icon: Icon, title, id }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-elevated hover:text-gold transition-all"
                >
                  <Icon size={14} className="text-gold/70 shrink-0" />
                  {title}
                </a>
              ))}
              <div className="pt-4 mt-4 border-t border-border">{uiText.rich("Ui.text_8158912a830550", { part2: () => (<MessageSquare size={12} />), part3: () => (<ArrowRight size={11} />), part1: chunks => (<Link
                  href="/help"
                  className="flex items-center gap-2 px-3 py-2 text-xs text-gold hover:text-gold-light transition-colors"
                >{chunks}</Link>) })}</div>
            </div>
          </aside>

          {/* Sections */}
          <div className="flex-1 min-w-0 space-y-12 [overflow-wrap:anywhere]">
            {sections.map(({ icon: Icon, title, id, content }) => (
              <section key={id} id={id} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gold/10 border border-gold/20 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-gold" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-text-primary">{title}</h2>
                </div>
                <div className="space-y-5">
                  {content.map(({ heading, body }) => (
                    <div key={heading} className="p-5 bg-bg-secondary border border-border rounded-xl">
                      <h3 className="font-semibold text-text-primary mb-2">{heading}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Report CTA */}
            <div className="p-6 bg-bg-secondary border border-border rounded-xl flex items-start gap-4">
              <div className="w-10 h-10 bg-crimson/10 border border-crimson/20 rounded-xl flex items-center justify-center shrink-0">
                <Flag size={16} className="text-crimson-light" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-1">{uiText("Ui.text_2ff6abcb72740c")}</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-3">{uiText("Ui.text_afca3743010620")}</p>
                <Link
                  href="/help"
                  className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold-light transition-colors font-medium"
                >{uiText.rich("Ui.text_829d4ef8158c41", { part1: () => (<ArrowRight size={13} />) })}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
