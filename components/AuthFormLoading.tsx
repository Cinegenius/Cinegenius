export default function AuthFormLoading() {
  return (
    <div aria-label="Anmeldeformular wird geladen" aria-busy="true" className="w-full max-w-md">
      <div className="space-y-3 rounded-2xl border border-border bg-bg-elevated p-6">
        <div className="h-11 rounded-xl border border-border bg-bg-secondary" />
        <div className="h-11 rounded-xl border border-border bg-bg-secondary" />
        <div className="h-11 rounded-xl bg-gold/25" />
        <p className="text-center text-xs text-text-muted">Formular wird geladen …</p>
      </div>
    </div>
  );
}
