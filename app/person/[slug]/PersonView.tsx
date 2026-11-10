"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clapperboard, UserRound, Loader2, Check, ArrowLeft, ShieldAlert, Film,
} from "lucide-react";
import { useTranslations } from "next-intl";


const PROJECT_TYPE_NORMALIZE: Record<string, string> = {
  "Werbefilm / Commercial": "Werbefilm",
  "Corporate Film": "Corporate",
  "Event / Live": "Event",
  "Foto / Shooting": "Shooting",
};
function normType(t: string | null | undefined): string | null {
  if (!t) return null;
  return PROJECT_TYPE_NORMALIZE[t] ?? t;
}

type Project = {
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  director: string | null;
  poster_url: string | null;
};

type Credit = {
  id: string;
  role: string;
  created_at: string;
  projects: Project | null;
};

type Profile = {
  id: string;
  name: string;
  slug: string;
  primary_role: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function PersonView({
  profile,
  credits,
  isSignedIn,
}: {
  profile: Profile;
  credits: Credit[];
  isSignedIn: boolean;
}) {
  const uiText = useTranslations();

  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimed, setClaimed] = useState(false);

  async function handleClaim() {
    setClaiming(true);
    setClaimError("");
    try {
      const res = await fetch(`/api/unclaimed-profiles/${profile.slug}/claim`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setClaimError(json.error ?? uiText("Ui.text_f84c843b1893d2")); return; }
      setClaimed(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-gold transition-colors mb-8">{uiText.rich("Ui.text_45f48c2ceb22a9", { part1: () => (<ArrowLeft size={14} />) })}</Link>

        {/* Claim banner */}
        {isSignedIn && !claimed && (
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border border-gold/30 bg-gold/5">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary mb-0.5">{uiText("Ui.text_d6f21a5bbf2ba7")}</p>
              <p className="text-sm text-text-muted">{uiText.rich("Ui.text_fe7a112045b017", { value1: () => (profile.name) })}</p>
              {claimError && <p className="text-xs text-red-400 mt-2">{claimError}</p>}
            </div>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 text-sm"
            >
              {claiming ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {claiming ? uiText("Ui.text_b76aa89b84f5a4") : uiText("Ui.text_43be13e6fd9ab2")}
            </button>
          </div>
        )}

        {claimed && (
          <div className="mb-8 flex items-center gap-3 p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
            <Check size={18} className="text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-text-primary">{uiText("Ui.text_3851b00993a6db")}</p>
              <p className="text-sm text-text-muted">{uiText("Ui.text_f976c85a155a01")}</p>
            </div>
          </div>
        )}

        {!isSignedIn && (
          <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl border border-border bg-bg-secondary">
            <ShieldAlert size={16} className="text-text-muted shrink-0" />
            <p className="text-sm text-text-muted">{uiText.rich("Ui.text_f9c788da5540e2", { part1: chunks => (<Link href="/sign-in" className="text-gold hover:underline">{chunks}</Link>), value2: () => (profile.name) })}</p>
          </div>
        )}

        {/* Profile header */}
        <div className="flex items-start gap-5 mb-10">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-bg-secondary border border-border shrink-0 flex items-center justify-center">
            {profile.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <UserRound size={32} className="text-text-muted" />
            }
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-2xl font-bold text-text-primary">{profile.name}</h1>
              <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border border-border text-text-muted bg-bg-secondary">{uiText("Ui.text_dfb13797d10629")}</span>
            </div>
            {profile.primary_role && (
              <p className="text-sm text-text-muted mb-2">{profile.primary_role}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-text-secondary">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Projects */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">{uiText.rich("Ui.text_7969fd570aa19d", { part1: () => (<Film size={12} />), value2: () => (credits.length) })}</h2>

          {credits.length === 0 ? (
            <p className="text-sm text-text-muted">{uiText("Ui.text_c413cecb91c128")}</p>
          ) : (
            <div className="space-y-3">
              {credits.map((credit) => {
                const project = credit.projects;
                if (!project) return null;
                const [roleLabel, collaborator] = credit.role.split("||").map(s => s.trim());
                return (
                  <Link
                    key={credit.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-bg-secondary hover:border-gold/30 hover:bg-bg-elevated transition-all group"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-bg-elevated border border-border shrink-0 flex items-center justify-center">
                      {project.poster_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={project.poster_url} alt="" className="w-full h-full object-cover" />
                        : <Clapperboard size={16} className="text-text-muted" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{project.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {[normType(project.type), project.year, project.director].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-xs text-gold/80 mt-1">{roleLabel}{collaborator && <span className="text-text-muted ml-2">· {collaborator}</span>}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
