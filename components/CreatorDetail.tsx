"use client";

import { useState, useEffect } from "react";
import { useTranslations , useLocale } from "next-intl";
import { useGallerySelection } from "@/lib/use-gallery-selection";
import Link from "next/link";
import ContextBackLink from "@/components/ContextBackLink";
import Image from "@/components/MediaImage";
import {
  ArrowLeft, MapPin, Star, CheckCircle, Shield,
  MessageSquare, ChevronRight, Users, Loader2,
  UserPlus, UserCheck, Clock, Check, X, Lock,
  ExternalLink, Globe, Plane, Play, Quote, Pencil, Trash2,
  AtSign, PlayCircle, Video, Clapperboard, Calendar,
  Camera, Award, DollarSign,
} from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import ReviewsSection from "@/components/ReviewsSection";
import FavoriteButton from "@/components/FavoriteButton";
import Lightbox from "@/components/Lightbox";
import { uiErrorMessage } from "@/lib/ui-error-message";

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

function formatLastSeen(translate: (key: string, values?: Record<string, string | number>) => string, isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 5) return translate("Ui.text_41dd5825403591");
  if (mins < 60) return translate("Ui.text_40f6da5e688a71", { count: mins });
  if (hours < 24) return translate("Ui.text_a0e76b0367d9d0", { count: hours });
  if (days < 7) return translate("Ui.text_7d876c5f235da3", { count: days });
  if (days < 30) return translate("Ui.text_f82ed0be81f8a3", { count: Math.floor(days / 7) });
  return translate("Ui.text_439b74405c4d4a");
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
  const uiText = useTranslations();
  const uiLocale = useLocale();

  const tc = useTranslations("common");
  const profileText = useTranslations("profile");
  const bookingCopy = useTranslations("BookingRequest");
  const tcr = useTranslations("creators");
  const [activeSection, setActiveSection] = useState<"inquiry" | "message">("inquiry");
  const [message, setMessage] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [lightboxIdx, setLightboxIdx] = useGallerySelection(creator.portfolio_images ?? []);
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
      if (!res.ok) throw new Error(json.error ?? uiText("Ui.text_3d5d6608b0a99d"));
      setMsgSent(true); setMessage("");
    } catch (err) { setMsgError(uiErrorMessage(err, uiText("Ui.text_f6cc01cb7edbf0"))); }
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
      if (!res.ok) throw new Error(json.error ?? uiText("Ui.text_f6cc01cb7edbf0"));
      setRecSent(true); setShowRecForm(false);
      const updated = await fetch(`/api/recommendations?userId=${creator.id}`).then((r) => r.json());
      setRecommendations(updated.recommendations ?? []);
    } catch (err) { setRecError(uiErrorMessage(err, uiText("Ui.text_f6cc01cb7edbf0"))); }
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
      if (!res.ok) throw new Error(json.error ?? uiText("Ui.text_f6cc01cb7edbf0"));
      setCurrentFriendshipId(json.friendship.id); setCurrentFriendStatus("pending_sent");
    } catch (err) { setFriendError(uiErrorMessage(err, uiText("Ui.text_f6cc01cb7edbf0"))); }
    finally { setFriendLoading(false); }
  };

  const respondToRequest = async (status: "accepted" | "rejected") => {
    if (!currentFriendshipId) return;
    setFriendLoading(true); setFriendError("");
    try {
      const res = await fetch(`/api/friendships/${currentFriendshipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? uiText("Ui.text_f6cc01cb7edbf0"));
      setCurrentFriendStatus(status);
    } catch (err) { setFriendError(uiErrorMessage(err, uiText("Ui.text_f6cc01cb7edbf0"))); }
    finally { setFriendLoading(false); }
  };

  const removeFriend = async () => {
    if (!currentFriendshipId) return;
    setFriendLoading(true); setFriendError("");
    try {
      const res = await fetch(`/api/friendships/${currentFriendshipId}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? uiText("Ui.text_f6cc01cb7edbf0")); }
      setCurrentFriendStatus("none"); setCurrentFriendshipId(null);
    } catch (err) { setFriendError(uiErrorMessage(err, uiText("Ui.text_f6cc01cb7edbf0"))); }
    finally { setFriendLoading(false); }
  };

  const positions = (creator.positions?.length ? creator.positions : [creator.role]);
  const allVideos = [creator.reel_url, ...(creator.video_links ?? [])].filter(Boolean) as string[];
  const socialLinks = [
    { url: creator.instagram_url, icon: AtSign,        label: uiText("Ui.text_bad57ef7837c8e"),  color: "text-pink-400" },
    { url: creator.tiktok_url,    icon: PlayCircle,    label: uiText("Ui.text_1bb6fcfbf1368a"),     color: "text-text-secondary" },
    { url: creator.youtube_url,   icon: Video,         label: uiText("Ui.text_fb7accfff8c6f8"),    color: "text-red-400" },
    { url: creator.linkedin_url,  icon: Globe,         label: uiText("Ui.text_dd84425b72da12"),   color: "text-blue-400" },
    { url: creator.imdb_url,      icon: Award,         label: uiText("Ui.text_061f3a4e4a30d7"),       color: "text-amber-400" },
    { url: creator.website_url,   icon: Globe,         label: uiText("AdminReview.fields.website"),    color: "text-text-secondary" },
  ].filter((s) => s.url);

  const FriendButton = () => {
  const uiText = useTranslations();

    if (isOwnProfile || !currentUserId) return null;
    if (currentFriendStatus === "none" || currentFriendStatus === "rejected") return (
      <button onClick={sendFriendRequest} disabled={friendLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold/20 text-gold text-xs font-medium rounded-full hover:bg-gold/20 transition-colors disabled:opacity-50">{uiText.rich("Ui.text_7ace85e5f8b307", { value1: () => (friendLoading ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />) })}</button>
    );
    if (currentFriendStatus === "pending_sent") return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border text-text-muted text-xs rounded-full">{uiText.rich("Ui.text_6ef3d8e9ec1014", { part1: () => (<Clock size={12} />) })}</span>
    );
    if (currentFriendStatus === "pending_received") return (
      <div className="flex items-center gap-2">
        <button onClick={() => respondToRequest("accepted")} disabled={friendLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-full hover:bg-success/20 transition-colors disabled:opacity-50">{uiText.rich("Ui.text_f595baa92ebad7", { value1: () => (friendLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />) })}</button>
        <button onClick={() => respondToRequest("rejected")} disabled={friendLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-bg-secondary border border-border text-text-muted text-xs rounded-full hover:border-red-400 hover:text-red-400 transition-colors disabled:opacity-50">{uiText.rich("Ui.text_2424239b7d6d6c", { part1: () => (<X size={12} />) })}</button>
      </div>
    );
    if (currentFriendStatus === "accepted") return (
      <button onClick={removeFriend} disabled={friendLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-full hover:bg-red-500/10 hover:border-red-400/20 hover:text-red-400 transition-colors disabled:opacity-50">{uiText.rich("Ui.text_1185eeb2a56108", { value1: () => (friendLoading ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />) })}</button>
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
          <ContextBackLink href="/creators" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-white text-xs font-medium transition-colors">{uiText.rich("Ui.text_71de535944f89f", { part1: () => (<ArrowLeft size={13} />) })}</ContextBackLink>
        </div>

        {isOwnProfile && (
          <div className="absolute top-4 right-4">{uiText.rich("Ui.text_d27b2c548b981f", { part2: () => (<Pencil size={13} />), part1: chunks => (<Link href="/profile" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-gold text-xs font-medium transition-colors">{chunks}</Link>) })}</div>
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
                  <DollarSign size={13} className="text-gold" />{creator.day_rate.toLocaleString(uiLocale)} €{tc("perDay")}
                </span>
              )}
              {creator.travel_ready && (
                <span className="flex items-center gap-1"><Plane size={13} /> {profileText("fieldTravelReady")}</span>
              )}
              {creator.last_seen_at && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${Date.now() - new Date(creator.last_seen_at).getTime() < 5 * 60000 ? "bg-success" : "bg-text-muted"}`} />
                  {formatLastSeen(uiText, creator.last_seen_at)}
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
              <div className="text-[10px] text-text-muted uppercase tracking-widest">{uiText("Ui.text_2a6b24ad287220")}</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-text-primary">{creator.reviews}</div>
              <div className="text-[10px] text-text-muted uppercase tracking-widest">{uiText("nav.projects")}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className={i < Math.floor(creator.rating) ? "text-gold fill-gold" : "text-border"} />
                ))}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-widest">{uiText.rich("Ui.text_10d8a5e26bd73e", { value1: () => (creator.reviews) })}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-10 flex-col lg:flex-row">
          {/* ── LEFT COLUMN ── */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Über mich */}
            {creator.bio && (
              <section>
                <SectionTitle icon={Users}>{uiText("Ui.text_3f8ab8360131de")}</SectionTitle>
                <p className="text-text-secondary leading-relaxed">{creator.bio}</p>
              </section>
            )}

            {/* Showreel / Videos */}
            {allVideos.length > 0 && (
              <section>
                <SectionTitle icon={Play}>{uiText("profile.sectionVideos")}</SectionTitle>
                <div className="space-y-4">
                  {allVideos.map((url, i) => {
                    const embedUrl = getEmbedUrl(url);
                    return embedUrl ? (
                      <div key={i} className="relative aspect-video rounded-2xl overflow-hidden border border-border shadow-lg">
                        <iframe src={embedUrl} title={uiText("Ui.text_7c5f4551b266c9", { value1: String(i + 1) })}
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
                <SectionTitle icon={Camera}>{uiText("Ui.text_1853eb2e9e5ed2")}</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(creator.portfolio_images ?? []).map((url, i) => (
                    <button key={url} onClick={() => setLightboxIdx(i)}
                      className={`rounded-xl overflow-hidden border border-border hover:border-gold transition-all hover:shadow-lg hover:shadow-gold/10 ${
                        i === 0 ? "col-span-2 aspect-video" : "aspect-square"
                      }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={uiText("Ui.text_3a1e6b953a8984", { value1: String(i + 1) })} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
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
                <SectionTitle icon={Clapperboard}>{uiText("profile.sectionFilmography")}</SectionTitle>
                <div className="space-y-2">
                  {[...projectCredits]
                    .sort((a, b) => (b.projects?.year ?? 0) - (a.projects?.year ?? 0))
                    .map((credit) => {
                      const [roleLabel, collaborator] = credit.role?.split("||") ?? ["", ""];
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
                              <span>{roleLabel}</span>
                              {collaborator && <>{uiText.rich("Ui.text_819bd4bbf6cc4a", { part1: chunks => (<span>{chunks}</span>), value3: () => (collaborator), part2: chunks => (<span>{chunks}</span>) })}</>}
                              {credit.projects?.director && <>{uiText.rich("Ui.text_38432540914b27", { part1: chunks => (<span>{chunks}</span>), value3: () => (credit.projects.director), part2: chunks => (<span>{chunks}</span>) })}</>}
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
                <SectionTitle icon={Award}>{uiText("Ui.text_9620ef01dde01d")}</SectionTitle>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{creator.experience}</p>
              </section>
            )}

            {/* Fähigkeiten */}
            {(creator.skills ?? []).length > 0 && (
              <section>
                <SectionTitle icon={CheckCircle}>{uiText("Ui.text_0f0478732ed1ba")}</SectionTitle>
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
                <SectionTitle icon={Globe}>{uiText("profile.sectionLanguages")}</SectionTitle>
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
                <SectionTitle icon={Quote} noMargin>{uiText.rich("Ui.text_16c95667074b37", { value1: () => (recommendations.length > 0 && <span className="text-sm font-normal text-text-muted ml-1">({recommendations.length})</span>) })}</SectionTitle>
                {!isOwnProfile && currentUserId && !alreadyWroteRec && !recSent && (
                  <button onClick={() => setShowRecForm((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">{uiText.rich("Ui.text_2e3fa7cd433318", { part1: () => (<Pencil size={12} />) })}</button>
                )}
                {recSent && <span className="flex items-center gap-1 text-xs text-success">{uiText.rich("Ui.text_2f50464d68aaef", { part1: () => (<CheckCircle size={12} />) })}</span>}
              </div>

              {showRecForm && (
                <div className="mb-6 p-5 bg-bg-secondary border border-gold/20 rounded-xl space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_46852aaa262254")}</label>
                      <input type="text" value={recForm.author_role} onChange={(e) => setRecForm((p) => ({ ...p, author_role: e.target.value }))}
                        placeholder={uiText("Ui.text_feb8233f0fcae9")}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_4408814c2404e8")}</label>
                      <input type="text" value={recForm.project} onChange={(e) => setRecForm((p) => ({ ...p, project: e.target.value }))}
                        placeholder={uiText("Ui.text_8581cd83e84d96")}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                  </div>
                  <textarea rows={4} value={recForm.content} onChange={(e) => setRecForm((p) => ({ ...p, content: e.target.value }))} maxLength={600}
                    placeholder={uiText("Ui.text_a790d1b8c43a23", { value1: String(creator.name.split(" ")[0]) })}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
                  <p className="text-xs text-text-muted text-right">{recForm.content.length} / 600</p>
                  {recError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{recError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowRecForm(false); setRecError(""); }}
                      className="px-4 py-2 text-sm text-text-muted border border-border rounded-lg hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
                    <button onClick={submitRecommendation} disabled={recSending || !recForm.author_role.trim() || !recForm.content.trim()}
                      className="px-4 py-2 text-sm font-semibold bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 flex items-center gap-2">
                      {recSending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      {recSending ? uiText("AdminReview.saving") : uiText("MarketplacePublishing.publish")}
                    </button>
                  </div>
                </div>
              )}

              {recsLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
              ) : recommendations.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border rounded-xl">
                  <Quote size={24} className="text-text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-text-muted">{uiText("Ui.text_a435e0d550b4d1")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="p-5 bg-bg-secondary border border-border rounded-xl relative group">
                      <Quote size={20} className="text-gold/20 absolute top-4 right-4" />
                      <p className="text-text-secondary text-sm leading-relaxed mb-4 pr-6">„{rec.content}“</p>
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
                          <p className="text-xs text-text-muted truncate">{rec.author_role}{rec.project ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(rec.project) }) : ""}</p>
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
                    ? uiText("Ui.text_4040b7c06c4e87", { value1: String(tcr("availableFrom")), value2: String(new Date(creator.available_from).toLocaleDateString(undefined, { day: "numeric", month: "long" })) })
                    : tcr("availableImmediately")
                  : tcr("currentlyBooked")}
              </div>

              {/* Tabs */}
              <div className="flex rounded-xl border border-border bg-bg-secondary p-1 gap-1">
                <button onClick={() => setActiveSection("inquiry")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeSection === "inquiry" ? "bg-gold text-bg-primary" : "text-text-secondary hover:text-gold"}`}>
                  {tcr("bookingInquiry")}
                </button>
                <button onClick={() => setActiveSection("message")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeSection === "message" ? "bg-gold text-bg-primary" : "text-text-secondary hover:text-gold"}`}>
                  {tcr("sendMessage")}
                </button>
              </div>

              {activeSection === "inquiry" && (
                creator.ownerId ? (
                  <InquiryForm listingId={creator.id} listingTitle={creator.name} listingType="creator" ownerId={creator.ownerId} ownerName={creator.name} />
                ) : (
                  <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center text-sm text-text-muted">
                    {tcr("inquiriesUnavailable")}
                  </div>
                )
              )}

              {activeSection === "message" && (
                <div className="bg-bg-secondary border border-border rounded-xl p-6">
                  {!canMessage ? (
                    <div className="text-center space-y-3 py-2">
                      <div className="w-12 h-12 bg-bg-elevated border border-border rounded-full flex items-center justify-center mx-auto"><Lock size={18} className="text-text-muted" /></div>
                      <p className="font-semibold text-text-primary text-sm">{uiText("Ui.text_29c8ec8b49aa6f")}</p>
                      <p className="text-xs text-text-muted leading-relaxed">{uiText("Ui.text_00dfadf6983ae3")}</p>
                    </div>
                  ) : msgSent ? (
                    <div className="text-center space-y-3 py-2">
                      <div className="w-12 h-12 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto"><CheckCircle size={22} className="text-success" /></div>
                      <p className="font-semibold text-text-primary">{uiText("Ui.text_95aa00aa984848")}</p>
                      <button onClick={() => { setMsgSent(false); setMessage(""); }} className="text-xs text-gold hover:text-gold-light transition-colors">{uiText("Ui.text_5928a284cf930d")}</button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-text-primary mb-1">{uiText("companyMessages.send")}</h3>
                      <p className="text-text-muted text-xs mb-4">{uiText("Ui.text_d03a03c81f97e6")}</p>
                      <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                        placeholder={uiText("Ui.text_744506c61723c7", { value1: String(creator.name.split(" ")[0]) })}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none mb-3" />
                      {msgError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{msgError}</p>}
                      <button onClick={sendMessage} disabled={!message.trim() || msgSending || !creator.ownerId}
                        className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                        {msgSending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        {msgSending ? uiText("Ui.text_e37bd862386549") : uiText("companyMessages.send")}
                      </button>
                      <p className="text-center text-xs text-text-muted mt-2 flex items-center justify-center gap-1">{uiText.rich("Ui.text_9cbc04b6b9d3b9", { part1: () => (<Shield size={11} />), value2: () => (creator.name.split(" ")[0]) })}</p>
                    </>
                  )}
                </div>
              )}

              <div className="p-4 bg-bg-secondary border border-border rounded-xl space-y-3">
                {[
                  { icon: Shield, text: bookingCopy("directTerms") },
                  { icon: Users, text: bookingCopy("noCommission") },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs text-text-muted">
                    <Icon size={13} className="text-gold shrink-0" />{text}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gold-subtle border border-gold/20 rounded-xl">
                <p className="text-xs font-semibold text-gold mb-2 flex items-center gap-1"><ChevronRight size={12} /> {bookingCopy("howItWorks")}</p>
                <ol className="space-y-1.5 text-xs text-text-muted">
                  {[bookingCopy("flow1"), bookingCopy("flow2"), bookingCopy("flow3"), bookingCopy("flow4")].map((step, i) => (
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
