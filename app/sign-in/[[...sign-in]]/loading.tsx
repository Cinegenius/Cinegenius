import AuthFormLoading from "@/components/AuthFormLoading";

export default function Loading() {
  return (
    <div className="min-h-screen bg-bg-primary px-4 pt-28">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-bg-elevated" />
        <AuthFormLoading />
      </div>
    </div>
  );
}
