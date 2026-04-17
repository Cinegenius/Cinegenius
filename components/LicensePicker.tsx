"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, ChevronDown, Search, ShieldCheck } from "lucide-react";
import { LICENSE_CATEGORIES } from "@/lib/licenses";

type Props = {
  selected: string[];
  onChange: (licenses: string[]) => void;
};

export default function LicensePicker({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const add = (license: string) => {
    if (!selected.includes(license)) onChange([...selected, license]);
  };

  const remove = (license: string) => onChange(selected.filter((l) => l !== license));

  const addCustom = () => {
    const v = customInput.trim();
    if (v.length < 4) return; // Verhindert "A", "B" als Freitext
    if (!selected.includes(v)) onChange([...selected, v]);
    setCustomInput("");
    setShowCustom(false);
  };

  // Filter categories + items by search query
  const q = search.toLowerCase();
  const filtered = q
    ? LICENSE_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.toLowerCase().includes(q)),
      })).filter((cat) => cat.items.length > 0)
    : LICENSE_CATEGORIES;

  return (
    <div className="space-y-3">

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((lic) => (
            <span
              key={lic}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/8 border border-gold/20 rounded-full text-xs text-gold font-medium"
            >
              <ShieldCheck size={10} className="shrink-0" />
              {lic}
              <button
                type="button"
                onClick={() => remove(lic)}
                className="hover:text-red-400 transition-colors ml-0.5"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Picker trigger */}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setSearch(""); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${
            open
              ? "border-gold text-gold bg-gold/5"
              : "border-border text-text-muted hover:border-border-hover hover:text-text-secondary bg-bg-elevated"
          }`}
        >
          <Plus size={14} />
          Lizenz hinzufügen
          <ChevronDown size={12} className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute top-full left-0 mt-2 z-50 w-full sm:w-[480px] max-h-[420px] overflow-hidden bg-bg-elevated border border-border rounded-xl shadow-2xl flex flex-col">

            {/* Search */}
            <div className="p-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-lg px-3 py-2 focus-within:border-gold/50 transition-colors">
                <Search size={13} className="text-text-muted shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="bg-transparent border-none text-sm w-full focus:outline-none text-text-primary placeholder:text-text-muted"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-primary">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Category list */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">Keine Treffer für „{search}"</p>
              ) : (
                filtered.map((cat) => (
                  <div key={cat.id}>
                    <div className="px-4 py-2 bg-bg-secondary border-b border-border/60 sticky top-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                        <span>{cat.icon}</span> {cat.label}
                      </p>
                    </div>
                    <div className="p-2 flex flex-wrap gap-1.5">
                      {cat.items.map((item) => {
                        const isSelected = selected.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => { if (!isSelected) { add(item); } else { remove(item); } }}
                            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                              isSelected
                                ? "bg-gold/12 border-gold/30 text-gold font-medium"
                                : "border-border/60 text-text-secondary hover:border-gold/30 hover:text-text-primary hover:bg-white/[0.03]"
                            }`}
                          >
                            {isSelected && <span className="mr-1">✓</span>}
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCustom((v) => !v)}
                className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                + Sonstige / nicht gelistete Lizenz
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom license input — clearly marked as exception */}
      {showCustom && (
        <div className="p-3 bg-bg-elevated border border-border/60 border-dashed rounded-xl">
          <p className="text-[10px] text-text-muted mb-2 uppercase tracking-wider font-semibold">Sonstige Lizenz (Ausnahme)</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Min. 4 Zeichen — z.B. IRATA Level 2"
              className="flex-1 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors text-text-primary placeholder:text-text-muted"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={customInput.trim().length < 4}
              className="px-3 py-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-40 text-xs font-medium"
            >
              Hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
