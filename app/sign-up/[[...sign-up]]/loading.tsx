export default function Loading() {
  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-bg-elevated animate-pulse" />
        ))}
        <div className="h-12 rounded-xl bg-gold/20 animate-pulse" />
      </div>
    </div>
  );
}
