"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export default function RoleDropdown({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm hover:border-gold/50 focus:outline-none focus:border-gold transition-colors"
      >
        <span className={value ? "text-text-primary" : "text-text-muted"}>{value || "Rolle wählen…"}</span>
        <ChevronDown size={13} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-bg-elevated border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={11} className="text-text-muted shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 bg-transparent text-xs text-text-primary focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">Keine Treffer</p>}
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-secondary ${value === o ? "text-gold font-semibold" : "text-text-primary"}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
