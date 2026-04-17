"use client";

import { useState, useRef } from "react";
import { Zap, Copy, Check, RefreshCw } from "lucide-react";

export default function CreativeSpark() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const generate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setOutput("");
    setError("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/creative-spark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Generieren");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Etwas ist schiefgelaufen.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">

        {/* Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-4">
          <Zap size={11} className="fill-gold" /> KI-Feature
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">
          Kreativer Funke
        </h2>
        <p className="text-text-muted text-sm mb-8 leading-relaxed">
          Gib ein paar Stichpunkte ein — unsere KI schreibt dir sofort einen Story-Pitch daraus.
        </p>

        {/* Input */}
        <div className="relative mb-3">
          <textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
            placeholder="z. B. verlassene Fabrik · zwei Fremde · Regenabend · ein Geheimnis"
            className="w-full bg-bg-secondary border border-border rounded-2xl px-5 py-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
            maxLength={400}
          />
          <span className="absolute bottom-3 right-4 text-[10px] text-text-muted">{input.length}/400</span>
        </div>

        <button
          onClick={generate}
          disabled={loading || !input.trim()}
          className="w-full py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mb-8"
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> Funke zündet…
            </>
          ) : (
            <>
              <Zap size={14} /> Funke zünden
            </>
          )}
        </button>

        {/* Output */}
        {(output || loading) && (
          <div className="relative rounded-2xl border border-gold/20 bg-gold-subtle p-6 text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-gold font-semibold">Story-Pitch</span>
            </div>

            <p className="text-sm text-text-primary leading-relaxed">
              {output}
              {loading && <span className="inline-block w-0.5 h-3.5 bg-gold animate-pulse ml-0.5 rounded-full" />}
            </p>

            {!loading && output && (
              <button
                onClick={copy}
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors"
              >
                {copied ? <><Check size={11} /> Kopiert!</> : <><Copy size={11} /> Pitch kopieren</>}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-crimson-light mt-3">{error}</p>
        )}

        <p className="text-[10px] text-text-muted mt-6 opacity-60">
          Powered by Groq · Llama 3.1 · kostenlos
        </p>
      </div>
    </section>
  );
}
