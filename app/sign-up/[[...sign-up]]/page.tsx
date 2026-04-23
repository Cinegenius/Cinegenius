import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="pt-16 min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Kostenlos starten</p>
          <h1 className="font-display text-3xl font-bold text-text-primary">Account erstellen</h1>
        </div>
        <SignUp
          forceRedirectUrl="/profile-setup"
          appearance={{
            variables: {
              colorPrimary: "#C2F135",
              colorTextOnPrimaryBackground: "#0A0A0A",
              colorBackground: "#1A1A1A",
              colorInputBackground: "#141414",
              colorInputText: "#EFEFEF",
              colorText: "#EFEFEF",
              colorTextSecondary: "#AAAAAA",
              colorNeutral: "#666666",
              borderRadius: "0.75rem",
              fontFamily: "Inter, system-ui, sans-serif",
            },
            elements: {
              headerTitle: "hidden",
              headerSubtitle: "hidden",
            },
          }}
        />
      </div>
    </div>
  );
}
