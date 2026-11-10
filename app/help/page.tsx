"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp, MessageSquare, Mail, BookOpen, MapPin, Package, Briefcase, Shield, Car, PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";





function getLocalizedCategories(translate: (key: string) => string) {
  return ([
  {
    icon: BookOpen,
    label: translate("Ui.text_232c9caabcc362"),
    items: [
      {
        q: translate("Ui.text_c0397b86b6acfd"),
        a: translate("Ui.text_f02d146f3e098d"),
      },
      {
        q: translate("Ui.text_7237cd1f700480"),
        a: translate("Ui.text_5d7322b563f933"),
      },
      {
        q: translate("Ui.text_2fd5173f2cbb9c"),
        a: translate("Ui.text_0e149f944a9c36"),
      },
      {
        q: translate("Ui.text_35080d686eadb3"),
        a: translate("Ui.text_b1bedfc7113d76"),
      },
    ],
  },
  {
    icon: MapPin,
    label: translate("nav.locations"),
    items: [
      {
        q: translate("Ui.text_14262cd693898d"),
        a: translate("Ui.text_b06c28a3d12af0"),
      },
      {
        q: translate("Ui.text_44e28c14fa9ae7"),
        a: translate("Ui.text_2f3e72f1bf18d0"),
      },
      {
        q: translate("Ui.text_0cb536e243bf67"),
        a: translate("Ui.text_284a3a0e13f1c7"),
      },
    ],
  },
  {
    icon: Package,
    label: translate("Ui.text_e512dbd2b58a8b"),
    items: [
      {
        q: translate("Ui.text_6b1f909fc968ae"),
        a: translate("Ui.text_8dd5663d275cda"),
      },
      {
        q: translate("Ui.text_5f048e755d7f6c"),
        a: translate("Ui.text_b0007f0e5db38e"),
      },
      {
        q: translate("Ui.text_dcff3d216808c3"),
        a: translate("Ui.text_5401229f93f5f8"),
      },
    ],
  },
  {
    icon: Car,
    label: translate("footer.links_vehicles"),
    items: [
      {
        q: translate("Ui.text_0a4347d5f1b6c9"),
        a: translate("Ui.text_452b8ae2aeaf1e"),
      },
      {
        q: translate("Ui.text_5e264fc254f41a"),
        a: translate("Ui.text_2fc537a7d3fd9d"),
      },
      {
        q: translate("Ui.text_0a67cbacc429c2"),
        a: translate("Ui.text_8576edc4aadf97"),
      },
    ],
  },
  {
    icon: PawPrint,
    label: translate("Ui.text_d9609c949e931a"),
    items: [
      {
        q: translate("Ui.text_8a8693ff819d35"),
        a: translate("Ui.text_8baf134a3204b2"),
      },
      {
        q: translate("Ui.text_c28963b689a760"),
        a: translate("Ui.text_89fc1207c645ad"),
      },
      {
        q: translate("Ui.text_81914e6a8d6538"),
        a: translate("Ui.text_53ee328cf84607"),
      },
    ],
  },
  {
    icon: Briefcase,
    label: translate("Ui.text_bdfa14e1b38649"),
    items: [
      {
        q: translate("Ui.text_9d21b13a0a1934"),
        a: translate("Ui.text_0fde0e5360432e"),
      },
      {
        q: translate("Ui.text_47fc5853a3022d"),
        a: translate("Ui.text_6f1b2038b1488b"),
      },
      {
        q: translate("Ui.text_a09e33d4d9d83f"),
        a: translate("Ui.text_fedc2ddbecd3a3"),
      },
      {
        q: translate("Ui.text_9ecf3a88360bb2"),
        a: translate("Ui.text_d78932ee50b0dd"),
      },
    ],
  },
  {
    icon: BookOpen,
    label: translate("Ui.text_854275885a9851"),
    items: [
      { q: translate("Ui.text_f466f86a12a014"), a: translate("Ui.text_ddea6729a28713") },
      { q: translate("Ui.text_1ade5581502ca9"), a: translate("Ui.text_b169cf44e42adb") },
      { q: translate("Ui.text_4a610b516161ec"), a: translate("Ui.text_e1893e6dffad16") },
      { q: translate("Ui.text_6799588f07af0d"), a: translate("Ui.text_620b510d55014a") },
    ],
  },
  {
    icon: Shield,
    label: translate("Ui.text_42cae79597c266"),
    items: [
      {
        q: translate("Ui.text_2e5ba026b3573b"),
        a: translate("Ui.text_ecefd7ab0c5e0f"),
      },
      {
        q: translate("Ui.text_768fcf92332f19"),
        a: translate("Ui.text_08ec7448a5e8e5"),
      },
      {
        q: translate("Ui.text_35352e055b2273"),
        a: translate("Ui.text_98b2f10d612454"),
      },
    ],
  },
]);
}

export default function HelpPage() {
  const uiText = useTranslations();
  const categories = getLocalizedCategories(uiText);


  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));

  const filtered = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          !query.trim() ||
          item.q.toLowerCase().includes(query.toLowerCase()) ||
          item.a.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter(
      (cat) =>
        (!activeCategory || cat.label === activeCategory) && cat.items.length > 0
    );

  return (
    <div className="pt-16 min-h-screen">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">{uiText("Ui.text_0c014891cbffd5")}</h1>
          <p className="text-text-muted mb-8">{uiText("Ui.text_6c4fc6a65a4166")}</p>
          <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-4 focus-within:border-gold transition-colors">
            <Search size={16} className="text-text-muted" />
            <input
              type="text"
              placeholder={uiText("Ui.text_1b86a7229ab830")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none py-3.5 text-sm w-full focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Category tabs */}
        {!query && (
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                !activeCategory
                  ? "bg-gold text-bg-primary border-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >{uiText("Ui.text_f5c129c2aab569")}</button>
            {categories.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActiveCategory(activeCategory === label ? null : label)}
                className={`px-4 py-2 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  activeCategory === label
                    ? "bg-gold text-bg-primary border-gold"
                    : "border-border text-text-secondary hover:border-gold hover:text-gold"
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* FAQ Sections */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-2">{uiText.rich("Ui.text_ca4ec38ac19663", { value1: () => (query) })}</p>
            <button
              onClick={() => setQuery("")}
              className="text-gold text-sm hover:text-gold-light transition-colors"
            >{uiText("Ui.text_b75f4841525e7a")}</button>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map(({ label, icon: Icon, items }) => (
              <section key={label}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon size={16} className="text-gold" />
                  <h2 className="font-display text-lg font-bold text-text-primary">{label}</h2>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const key = `${label}-${item.q}`;
                    const isOpen = openItems[key];
                    return (
                      <div key={key} className="border border-border rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-bg-elevated transition-colors"
                        >
                          <span className="text-sm font-medium text-text-primary">{item.q}</span>
                          {isOpen ? (
                            <ChevronUp size={15} className="text-gold shrink-0" />
                          ) : (
                            <ChevronDown size={15} className="text-text-muted shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed border-t border-border pt-4">
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="mt-16 p-8 bg-bg-secondary border border-border rounded-2xl text-center">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">{uiText("Ui.text_28881025f27160")}</h2>
          <p className="text-text-muted mb-6 text-sm">{uiText("Ui.text_eb2f0ea66d2081")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">{uiText.rich("Ui.text_4f778e3c677bc4", { part2: () => (<Mail size={15} />), part1: chunks => (<a
              href="mailto:cinegenius.co@gmail.com"
              className="px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
            >{chunks}</a>), part4: () => (<MessageSquare size={15} />), part3: chunks => (<Link
              href="/dashboard"
              className="px-6 py-3 border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors flex items-center justify-center gap-2"
            >{chunks}</Link>) })}</div>
        </div>
      </div>
    </div>
  );
}
