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
              colorPrimary: "#0EA5E9",
              colorBackground: "#1A1A1A",
              colorInputBackground: "#212121",
              colorInputText: "#EFEFEF",
              colorText: "#EFEFEF",
              colorTextSecondary: "#888888",
              colorNeutral: "#505050",
              borderRadius: "0.75rem",
              fontFamily: "Inter, system-ui, sans-serif",
            },
            elements: {
              card: "bg-bg-elevated border border-border shadow-deep",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "border-border text-text-secondary hover:border-gold/40 hover:text-text-primary transition-all",
              dividerLine: "bg-border",
              dividerText: "text-text-muted",
              formFieldLabel: "text-text-secondary text-sm",
              formFieldInput: "bg-bg-hover border-border text-text-primary focus:border-gold",
              footerActionLink: "text-gold hover:text-gold-light",
              formButtonPrimary: "bg-gold hover:bg-gold-light text-bg-primary font-semibold transition-colors",
            },
          }}
        />
      </div>
    </div>
  );
}
