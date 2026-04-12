"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, MapPin, Star, CheckCircle, Shield,
  MessageSquare, ChevronRight, Film, Users, Loader2,
  UserPlus, UserCheck, Clock, Check, X, Lock,
  ExternalLink, Globe, Plane, Play, Quote, Pencil, Trash2,
  AtSign, PlayCircle, Video, Clapperboard, Calendar,
  Camera, Award, DollarSign,
} from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import ReviewsSection from "@/components/ReviewsSection";
import FavoriteButton from "@/components/FavoriteButton";
import Lightbox from "@/components/Lightbox";

type FilmographyEntry = {
  year: number;
  title: string;
  role: string;
  type: string;
  director?: string;
};

type Creator = {
  id: string;
  name: string;
  role: string;
  positions?: string[];
  location: string;
  image: string;
  cover_image_url?: string | null;
  rating: number;
  reviews: number;
  dayRate: string;
  day_rate?: number | null;
  available: boolean;
  available_from?: string | null;
  credits: string[];
  skills: string[];
  languages?: string[];
  bio?: string;
  experience?: string;
  portfolio_images?: string[];
  video_links?: string[];
  filmography?: FilmographyEntry[];
  verified: boolean;
  reel_url?: string | null;
  imdb_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  travel_ready?: boolean;
  last_seen_at?: string | null;
  ownerId?: string;
};

function formatLastSeen(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 5)   return "Gerade eben aktiv";
  if (mins < 60)  return `Vor ${mins} Minuten aktiv`;
  if (hours < 24) return `Vor ${hours} Stunde${hours !== 1 ? "n" : ""} aktiv`;
  if (days < 7)   return `Vor ${days} Tag${days !== 1 ? "en" : ""} aktiv`;
  if (days < 30)  return `Vor ${Math.floor(days / 7)} Woche${Math.floor(days / 7) !== 1 ? "n" : ""} aktiv`;
  return "Vor mehr als einem Monat aktiv";
}

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

const filmTypeColors: Record<string, string> = {
  Spielfilm:    "bg-purple-500/10 border-purple-500/20 text-purple-400",
  Kurzfilm:     "bg-blue-500/10 border-blue-500/20 text-blue-400",
  Serie:        "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  Dokumentation:"bg-amber-500/10 border-amber-500/20 text-amber-400",
  Werbefilm:    "bg-rose-500/10 border-rose-500/20 text-rose-400",
  Musikvideo:   "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400",
};

type Recommendation = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  project: string | null;
  content: string;
  created_at: string;
};

type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "rejected";

export default function CreatorDetail({
  creator,
  friendshipId,
  friendStatus = "none",
  canMessage = true,
  isOwnProfile = false,
  currentUserId,
}: {
  creator: Creator;
  friendshipId?: string;
  friendStatus?: FriendStatus;
  canMessage?: boolean;
  isOwnProfile?: boolean;
  currentUserId?: string | null;
}) {
  const [activeSection, setActiveSection] = useState<"inquiry" | "message">("inquiry");
  const [message, setMessage] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const totalPortfolio = creator.portfolio_images?.length ?? 0;

  const [currentFriendStatus, setCurrentFriendStatus] = useState<FriendStatus>(friendStatus);
  const [currentFriendshipId, setCurrentFriendshipId] = useState<string | null>(friendshipId ?? null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState("");

  type ProjectCredit = {
    id: string; role: string; project_id: string;
    projects: { id: string; title: string; year: number | null; type: string | null; director: string | null; poster_url: string | null };
  };
  const [projectCredits, setProjectCredits] = useState<ProjectCredit[]>([]);

  useEffect(() => {
    fetch(`/api/project-credits?user_id=${creator.id}`)
      .then((r) => r.json())
      .then(({ credits }) => { if (credits) setProjectCredits(credits); })
      .catch(() => {});
  }, [creator.id]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [showRecForm, setShowRecForm] = useState(false);
  const [recForm, setRecForm] = useState({ author_role: "", project: "", content: "" });
  const [recSending, setRecSending] = useState(false);
  const [recError, setRecError] = useState("");
  const [recSent, setRecSent] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || !creator.ownerId) return;
    setMsgSending(true); setMsgError("");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: creator.id, listing_title: creator.name, listing_type: "creator", receiver_id: creator.ownerId, content: message.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Senden");
      setMsgSent(true); setMessage("");
    } catch (err) { setMsgError(err instanceof Error ? err.message : "Fehler"); }
    finally { setMsgSending(false); }
  };

  useEffect(() => {
    fetch(`/api/recommendations?userId=${creator.id}`)
      .then((r) => r.json()).then(({ recommendations: data }) => setRecommendations(data ?? []))
      .catch(() => {}).finally(() => setRecsLoading(false));
  }, [creator.id]);

  const submitRecommendation = async () => {
    if (!recForm.author_role.trim() || !recForm.content.trim()) return;
    setRecSending(true); setRecError("");
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: creator.id, content: recForm.content, author_role: recForm.author_role, project: recForm.project || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setRecSent(true); setShowRecForm(false);
      const updated = await fetch(`/api/recommendations?userId=${creator.id}`).then((r) => r.json());
      setRecommendations(updated.recommendations ?? []);
    } catch (err) { setRecError(err instanceof Error ? err.message : "Fehler"); }
    finally { setRecSending(false); }
  };

  const deleteRecommendation = async (id: string) => {
    await fetch(`/api/recommendations?id=${id}`, { method: "DELETE" });
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  };

  const alreadyWroteRec = recommendations.some((r) => r.author_id === currentUserId);

  const sendFriendRequest = async () => {
    if (!creator.ownerId || !currentUserId) return;
    setFriendLoading(true); setFriendError("");
    try {
      const res = await fetch("/api/friendships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiver_id: creator.ownerId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setCurrentFriendshipId(json.friendship.id); setCurrentFriendStatus("pending_sent");
    } catch (err) { setFriendError(err instanceof Error ? err.message : "Fehler"); }
    finally { setFriendLoading(false); }
  };

  const respondToRequest = async (status: "accepted" | "rejected") => {
    if (!currentFriendshipId) return;
    setFriendLoading(true); setFriendError("");
    try {
      const res = await fetch(`/api/friendships/${currentFriendshipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler");
      setCurrentFriendStatus(status);
    } catch (err) { setFriendError(err instanceof Error ? err.message : "Fehler"); }
    finally { setFriendLoading(false); }
  };

  const removeFriend = async () => {
    if (!currentFriendshipId) return;
    setFriendLoading(true); setFriendError("");
    try {
      const res = await fetch(`/api/friendships/${currentFriendshipId}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Fehler"); }
      setCurrentFriendStatus("none"); setCurrentFriendshipId(null);
    } catch (err) { setFriendError(err instanceof Error ? err.message : "Fehler"); }
    finally { setFriendLoading(false); }
  };

  const positions = (creator.positions?.length ? creator.positions : [creator.role]);
  const allVideos = [creator.reel_url, ...(creator.video_links ?? [])].filter(Boolean) as string[];
  const socialLinks = [
    { url: creator.instagram_url, icon: AtSign,        label: "Instagram",  color: "text-pink-400" },
    { url: creator.tiktok_url,    icon: PlayCircle,    label: "TikTok",     color: "text-text-secondary" },
    { url: creator.youtube_url,   icon: Video,         label: "YouTube",    color: "text-red-400" },
    { url: creator.linkedin_url,  icon: Globe,         label: "LinkedIn",   color: "text-blue-400" },
    { url: creator.imdb_url,      icon: Award,         label: "IMDb",       color: "text-amber-400" },
    { url: creator.website_url,   icon: Globe,         label: "Website",    color: "text-text-secondary" },
  ].filter((s) => s.url);

  const FriendButton = () => {
    if (isOwnProfile || !currentUserId) return null;
    if (currentFriendStatus === "none" || currentFriendStatus === "rejected") return (
      <button onClick={sendFriendRequest} disabled={friendLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold/20 text-gold text-xs font-medium rounded-full hover:bg-gold/20 transition-colors disabled:opacity-50">
        {friendLoading ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Freund hinzufügen
      </button>
    );
    if (currentFriendStatus === "pending_sent") return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border text-text-muted text-xs rounded-full">
        <Clock size={12} /> Anfrage gesendet
      </span>
    );
    if (currentFriendStatus === "pending_received") return (
      <div className="flex items-center gap-2">
        <button onClick={() => respondToRequest("accepted")} disabled={friendLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-full hover:bg-success/20 transition-colors disabled:opacity-50">
          {friendLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Annehmen
        </button>
        <button onClick={() => respondToRequest("rejected")} disabled={friendLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-bg-secondary border border-border text-text-muted text-xs rounded-full hover:border-red-400 hover:text-red-400 transition-colors disabled:opacity-50">
          <X size={12} /> Ablehnen
        </button>
      </div>
    );
    if (currentFriendStatus === "accepted") return (
      <button onClick={removeFriend} disabled={friendLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-full hover:bg-red-500/10 hover:border-red-400/20 hover:text-red-400 transition-colors disabled:opacity-50">
        {friendLoading ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />} Befreundet
      </button>
    );
    return null;
  };

  return (
    <div className="pt-16 min-h-screen bg-bg-primary">

      {/* ── COVER IMAGE ── */}
      <div className="relative h-52 sm:h-72 w-full overflow-hidden bg-bg-secondary">
        {creator.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bg-secondary via-gold/5 to-bg-elevated flex items-center justify-center">
            <Clapperboard size={48} className="text-border" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/20 to-transparent" />

        {/* Back link */}
        <div className="absolute top-4 left-4">
          <Link href="/creators" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-white text-xs font-medium transition-colors">
            <ArrowLeft size={13} /> Filmschaffende
          </Link>
        </div>

        {isOwnProfile && (
          <div className="absolute top-4 right-4">
            <Link href="/profile" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-gold text-xs font-medium transition-colors">
              <Pencil size={13} /> Bearbeiten
            </Link>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── PROFILE HEADER ── */}
        <div className="relative -mt-16 sm:-mt-20 mb-6 flex flex-col sm:flex-row sm:items-end gap-4">

          {/* Avatar */}
          <div className="relative shrink-0 self-start">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-bg-primary overflow-hidden shadow-2xl bg-bg-secondary">
              <Image src={creator.image} alt={creator.name} width={144} height={144} className="w-full h-full object-cover" priority />
            </div>
            <span className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-bg-primary ${creator.available ? "bg-success" : "bg-text-muted"}`} />
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary">{creator.name}</h1>
              {creator.verified && <CheckCircle size={20} className="text-success shrink-0" />}
              <FavoriteButton listingId={creator.id} listingType="creator" listingTitle={creator.name} listingCity={creator.location} className="ml-auto" />
            </div>

            {/* Positions */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {positions.map((p) => (
                <span key={p} className="px-2.5 py-1 bg-gold/10 border border-gold/20 rounded-full text-xs font-semibold text-gold">{p}</span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
              <span className="flex items-center gap-1"><MapPin size={13} />{creator.location}</span>
              {creator.day_rate && (
                <span className="flex items-center gap-1 text-text-secondary font-medium">
                  <DollarSign size={13} className="text-gold" />{creator.day_rate.toLocaleString("de-DE")} €/Tag
                </span>
              )}
              {creator.travel_ready && (
                <span className="flex items-center gap-1"><Plane size={13} /> Reisebereit</span>
              )}
              {creator.last_seen_at && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${Date.now() - new Date(creator.last_seen_at).getTime() < 24 * 3600000 ? "bg-success" : "bg-text-muted"}`} />
                  {formatLastSeen(creator.last_seen_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── SOCIAL LINKS + STATS ROW ── */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-6 border-b border-border">

          {/* Friend button */}
          <FriendButton />
          {friendError && <p className="text-xs text-red-400">{friendError}</p>}

          {/* Social links */}
          {socialLinks.map(({ url, icon: Icon, label, color }) => (
            <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
              title={label}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border rounded-full text-xs font-medium hover:border-gold transition-colors ${color}`}>
              <Icon size={13} />{label}
              <ExternalLink size={10} className="opacity-50" />
            </a>
          ))}

          {/* Stats */}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-center">
              <div className="text-base font-bold text-text-primary">{projectCredits.length}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-widest">Credits</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-text-primary">{creator.reviews}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-widest">Projekte</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className={i < Math.floor(creator.rating) ? "text-gold fill-gold" : "text-border"} />
                ))}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-widest">{creator.reviews} Bew.</div>
            </div>
          </div>
        </div>

        <div className="flex gap-10 flex-col lg:flex-row">
          {/* ── LEFT COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Über mich */}
            {creator.bio && (
              <section>
                <SectionTitle icon={Users}>Über mich</SectionTitle>
                <p className="text-text-secondary leading-relaxed">{creator.bio}</p>
              </section>
            )}

            {/* Showreel / Videos */}
            {allVideos.length > 0 && (
              <section>
                <SectionTitle icon={Play}>Videos & Showreel</SectionTitle>
                <div className="space-y-4">
                  {allVideos.map((url, i) => {
                    const embedUrl = getEmbedUrl(url);
                    return embedUrl ? (
                      <div key={i} className="relative aspect-video rounded-2xl overflow-hidden border border-border shadow-lg">
                        <iframe src={embedUrl} title={`Video ${i + 1}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen className="absolute inset-0 w-full h-full" />
                      </div>
                    ) : (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-border rounded-xl hover:border-gold transition-colors text-text-secondary hover:text-gold">
                        <Play size={18} />
                        <span className="text-sm truncate">{url}</span>
                        <ExternalLink size={14} className="shrink-0 ml-auto" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Portfolio Galerie */}
            {(creator.portfolio_images?.length ?? 0) > 0 && (
              <section>
                <SectionTitle icon={Camera}>Portfolio</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(creator.portfolio_images ?? []).map((url, i) => (
                    <button key={url} onClick={() => setLightboxIdx(i)}
                      className={`rounded-xl overflow-hidden border border-border hover:border-gold transition-all hover:shadow-lg hover:shadow-gold/10 ${
                        i === 0 ? "col-span-2 aspect-video" : "aspect-square"
                      }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Portfolio ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    </button>
                  ))}
                </div>
                {lightboxIdx !== null && (
                  <Lightbox
                    images={creator.portfolio_images!}
                    activeIndex={lightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                    onPrev={() => setLightboxIdx((i) => i !== null ? (i - 1 + totalPortfolio) % totalPortfolio : 0)}
                    onNext={() => setLightboxIdx((i) => i !== null ? (i + 1) % totalPortfolio : 0)}
                  />
                )}
              </section>
            )}

            {/* Filmografie — verknüpfte Projekte */}
            {projectCredits.length > 0 && (
              <section>
                <SectionTitle icon={Clapperboard}>Filmografie</SectionTitle>
                <div className="space-y-2">
                  {[...projectCredits]
                    .sort((a, b) => (b.projects?.year ?? 0) - (a.projects?.year ?? 0))
                    .map((credit) => {
                      const typeClass = filmTypeColors[credit.projects?.type ?? ""] ?? "bg-bg-secondary border-border text-text-muted";
                      return (
                        <Link
                          key={credit.id}
                          href={`/projects/${credit.project_id}`}
                          className="flex items-center gap-4 p-4 bg-bg-secondary border border-border rounded-xl hover:border-gold/30 transition-colors group"
                        >
                          <div className="w-12 text-center shrink-0">
                            <span className="text-sm font-bold text-gold">{credit.projects?.year ?? "—"}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-text-primary group-hover:text-gold transition-colors">
                                {credit.projects?.title}
                              </span>
                              {credit.projects?.type && (
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${typeClass}`}>
                                  {credit.projects.type}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                              <span>{credit.role}</span>
                              {credit.projects?.director && <><span>·</span><span>Regie: {credit.projects.director}</span></>}
                            </div>
                          </div>
                          <Calendar size={14} className="text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      );
                    })}
                </div>
              </section>
            )}

            {/* Erfahrung */}
            {creator.experience && (
              <section>
                <SectionTitle icon={Award}>Erfahrung & Referenzen</SectionTitle>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{creator.experience}</p>
              </section>
            )}

            {/* Fähigkeiten */}
            {(creator.skills ?? []).length > 0 && (
              <section>
                <SectionTitle icon={CheckCircle}>Fähigkeiten & Equipment</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {(creator.skills ?? []).map((s) => (
                    <span key={s} className="px-3 py-1.5 bg-bg-secondary border border-border text-text-secondary text-sm rounded-lg hover:border-gold/30 transition-colors">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Sprachen */}
            {(creator.languages?.length ?? 0) > 0 && (
              <section>
                <SectionTitle icon={Globe}>Sprachen</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {(creator.languages ?? []).map((l) => (
                    <span key={l} className="px-3 py-1.5 bg-bg-secondary border border-border text-text-secondary text-sm rounded-lg">{l}</span>
                  ))}
                </div>
              </section>
            )}

            {/* Empfehlungen */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <SectionTitle icon={Quote} noMargin>
                  Empfehlungen{recommendations.length > 0 && <span className="text-sm font-normal text-text-muted ml-1">({recommendations.length})</span>}
                </SectionTitle>
                {!isOwnProfile && currentUserId && !alreadyWroteRec && !recSent && (
                  <button onClick={() => setShowRecForm((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">
                    <Pencil size={12} /> Empfehlung schreiben
                  </button>
                )}
                {recSent && <span className="flex items-center gap-1 text-xs text-success"><CheckCircle size={12} /> Gespeichert</span>}
              </div>

              {showRecForm && (
                <div className="mb-6 p-5 bg-bg-secondary border border-gold/20 rounded-xl space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Deine Rolle *</label>
                      <input type="text" value={recForm.author_role} onChange={(e) => setRecForm((p) => ({ ...p, author_role: e.target.value }))}
                        placeholder="z.B. Regisseur, Produzentin…"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Projekt (optional)</label>
                      <input type="text" value={recForm.project} onChange={(e) => setRecForm((p) => ({ ...p, project: e.target.value }))}
                        placeholder={`z.B. "Das letzte Bild" (2024)`}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                  </div>
                  <textarea rows={4} value={recForm.content} onChange={(e) => setRecForm((p) => ({ ...p, content: e.target.value }))} maxLength={600}
                    placeholder={`Beschreibe deine Zusammenarbeit mit ${creator.name.split(" ")[0]}…`}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
                  <p className="text-xs text-text-muted text-right">{recForm.content.length} / 600</p>
                  {recError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{recError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowRecForm(false); setRecError(""); }}
                      className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
                    <button onClick={submitRecommendation} disabled={recSending || !recForm.author_role.trim() || !recForm.content.trim()}
                      className="px-4 py-2 text-sm font-semibold bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 flex items-center gap-2">
                      {recSending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      {recSending ? "Wird gespeichert…" : "Veröffentlichen"}
                    </button>
                  </div>
                </div>
              )}

              {recsLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : recommendations.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border rounded-xl">
                  <Quote size={24} className="text-text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-text-muted">Noch keine Empfehlungen</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="p-5 bg-bg-secondary border border-border rounded-xl relative group">
                      <Quote size={20} className="text-gold/20 absolute top-4 right-4" />
                      <p className="text-text-secondary text-sm leading-relaxed mb-4 pr-6">„{rec.content}"</p>
                      <div className="flex items-center gap-3">
                        {rec.author_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={rec.author_avatar} alt={rec.author_name} className="w-8 h-8 rounded-full object-cover border border-border shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-xs font-bold text-gold">
                            {rec.author_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary leading-tight">{rec.author_name}</p>
                          <p className="text-xs text-text-muted truncate">{rec.author_role}{rec.project ? ` · ${rec.project}` : ""}</p>
                        </div>
                        {rec.author_id === currentUserId && (
                          <button onClick={() => deleteRecommendation(rec.id)}
                            className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <ReviewsSection targetId={creator.id} targetType="creator" targetName={creator.name} />
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="lg:w-[320px] shrink-0">
            <div className="sticky top-20 space-y-4">

              {/* Availability badge */}
              <div className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${
                creator.available ? "border-success/30 bg-success/10 text-success" : "border-border text-text-muted"
              }`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${creator.available ? "bg-success" : "bg-text-muted"}`} />
                {creator.available
                  ? creator.available_from
                    ? `Verfügbar ab ${new Date(creator.available_from).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}`
                    : "Sofort verfügbar"
                  : "Derzeit gebucht"}
              </div>

              {/* Tabs */}
              <div className="flex rounded-xl border border-border bg-bg-secondary p-1 gap-1">
                <button onClick={() => setActiveSection("inquiry")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeSection === "inquiry" ? "bg-gold text-bg-primary" : "text-text-secondary hover:text-gold"}`}>
                  Buchungsanfrage
                </button>
                <button onClick={() => setActiveSection("message")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeSection === "message" ? "bg-gold text-bg-primary" : "text-text-secondary hover:text-gold"}`}>
                  Nachricht
                </button>
              </div>

              {activeSection === "inquiry" && (
                creator.ownerId ? (
                  <InquiryForm listingId={creator.id} listingTitle={creator.name} listingType="creator" ownerId={creator.ownerId} ownerName={creator.name} />
                ) : (
                  <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center text-sm text-text-muted">
                    Anfragen derzeit nicht verfügbar.
                  </div>
                )
              )}

              {activeSection === "message" && (
                <div className="bg-bg-secondary border border-border rounded-xl p-6">
                  {!canMessage ? (
                    <div className="text-center space-y-3 py-2">
                      <div className="w-12 h-12 bg-bg-elevated border border-border rounded-full flex items-center justify-center mx-auto"><Lock size={18} className="text-text-muted" /></div>
                      <p className="font-semibold text-text-primary text-sm">Nachrichten eingeschränkt</p>
                      <p className="text-xs text-text-muted leading-relaxed">Nur Freunde können eine Nachricht senden.</p>
                    </div>
                  ) : msgSent ? (
                    <div className="text-center space-y-3 py-2">
                      <div className="w-12 h-12 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto"><CheckCircle size={22} className="text-success" /></div>
                      <p className="font-semibold text-text-primary">Nachricht gesendet!</p>
                      <button onClick={() => { setMsgSent(false); setMessage(""); }} className="text-xs text-gold hover:text-gold-light transition-colors">Weitere Nachricht senden</button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-text-primary mb-1">Nachricht senden</h3>
                      <p className="text-text-muted text-xs mb-4">Antwortet üblicherweise innerhalb von 24h.</p>
                      <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                        placeholder={`Hallo ${creator.name.split(" ")[0]}, ich würde gerne über ein Projekt sprechen...`}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none mb-3" />
                      {msgError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{msgError}</p>}
                      <button onClick={sendMessage} disabled={!message.trim() || msgSending || !creator.ownerId}
                        className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                        {msgSending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        {msgSending ? "Wird gesendet..." : "Nachricht senden"}
                      </button>
                      <p className="text-center text-xs text-text-muted mt-2 flex items-center justify-center gap-1">
                        <Shield size={11} /> Privat · nur du und {creator.name.split(" ")[0]}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="p-4 bg-bg-secondary border border-border rounded-xl space-y-3">
                {[
                  { icon: Shield,       text: "Zahlungen über Treuhand gesichert" },
                  { icon: CheckCircle,  text: "Verifizierter Filmschaffender" },
                  { icon: Film,         text: `${creator.reviews} abgeschlossene Projekte` },
                  { icon: Users,        text: "Preisverhandlung findet privat statt" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs text-text-muted">
                    <Icon size={13} className="text-gold shrink-0" />{text}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gold-subtle border border-gold/20 rounded-xl">
                <p className="text-xs font-semibold text-gold mb-2 flex items-center gap-1"><ChevronRight size={12} /> So läuft es ab</p>
                <ol className="space-y-1.5 text-xs text-text-muted">
                  {["Anfrage senden mit Projektdetails", `${creator.name.split(" ")[0]} antwortet mit Konditionen`, "Preis & Details privat verhandeln", "Buchung bestätigen & sicher bezahlen"].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children, noMargin }: { icon: React.ElementType; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <h2 className={`font-display text-lg font-bold text-text-primary flex items-center gap-2 ${noMargin ? "" : "mb-4"}`}>
      <Icon size={16} className="text-gold shrink-0" />
      {children}
    </h2>
  );
}
