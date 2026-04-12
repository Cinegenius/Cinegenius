"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, List, Calendar, MessageSquare,
  BarChart2, Settings, Plus, Eye,
  Briefcase, CheckCircle, ChevronRight, ExternalLink,
  User, Wallet, ArrowDownCircle, Receipt, Send,
  Pencil, Save, Loader2, Heart, MapPin, Car, Package, Trash2,
  Users, UserPlus, Check, X, Globe, Lock, Clock,
  Building2, AlertCircle, FileText,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import ProfileGuard from "@/components/ProfileGuard";

type RealMessage = {
  id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type RealConversation = {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_type: string | null;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  updated_at: string;
  messages: RealMessage[];
};

type Booking = {
  id: string;
  ref: string;
  listing_title: string;
  listing_type: string;
  start_date: string;
  end_date: string;
  days: number;
  total: number;
  status: string;
  created_at: string;
};

const navItems = [
  { icon: LayoutDashboard, label: "Übersicht",      id: "overview" },
  { icon: User,            label: "Mein Profil",    id: "profil" },
  { icon: Building2,       label: "Meine Firma",    id: "firma" },
  { icon: List,            label: "Meine Inserate", id: "listings" },
  { icon: Briefcase,       label: "Jobs verwalten", id: "jobs" },
  { icon: Heart,           label: "Merkliste",      id: "favorites" },
  { icon: Users,           label: "Freunde",        id: "friends" },
  { icon: MessageSquare,   label: "Nachrichten",    id: "messages" },
  { icon: Calendar,        label: "Buchungen",      id: "bookings" },
  { icon: Wallet,          label: "Einnahmen",      id: "earnings" },
  { icon: ArrowDownCircle, label: "Auszahlungen",   id: "payouts" },
  { icon: Receipt,         label: "Transaktionen",  id: "transactions" },
  { icon: BarChart2,       label: "Analysen",       id: "analytics" },
  { icon: Settings,        label: "Einstellungen",  id: "settings" },
];


export default function DashboardPage() {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const [activeTab, setActiveTab] = useState("overview");
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Real listings from Supabase
  const [myListings, setMyListings] = useState<{ id: string; type: string; title: string; city: string; price: number; published: boolean; created_at: string; image_url: string | null; description: string }[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");

  // Profile sidebar data
  const [profileRole, setProfileRole] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileCompleteness, setProfileCompleteness] = useState(100);
  const [profileMissingFields, setProfileMissingFields] = useState<string[]>([]);

  // Analytics
  const [viewStats, setViewStats] = useState<{ views7: number; views14: number; trend: number; daily: number[] } | null>(null);

  useEffect(() => {
    // Presence ping
    fetch("/api/presence", { method: "POST" }).catch(() => {});

    // Profile + Completeness
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (profile?.display_name) setProfileDisplayName(profile.display_name);
        if (profile?.avatar_url) setProfileAvatarUrl(profile.avatar_url);
        if (profile?.role) setProfileRole(profile.role);
        else if (profile?.positions?.[0]) setProfileRole(profile.positions[0]);

        const checks = [
          { label: "Anzeigename",           ok: !!profile?.display_name },
          { label: "Profilfoto",            ok: !!profile?.avatar_url },
          { label: "Über mich / Bio",       ok: !!profile?.bio },
          { label: "Standort",              ok: !!profile?.location },
          { label: "Position / Rolle",      ok: (profile?.positions?.length ?? 0) > 0 },
          { label: "Fähigkeiten",           ok: (profile?.skills?.length ?? 0) > 0 },
          { label: "Sprachen",              ok: (profile?.languages?.length ?? 0) > 0 },
          { label: "Showreel / Reel-Link",  ok: !!(profile?.reel_url || profile?.showreel_url) },
          { label: "Tagessatz",             ok: !!(profile?.day_rate) },
          { label: "Filmografie",           ok: (profile?.filmography?.length ?? 0) > 0 },
          { label: "Verfügbarkeit",         ok: profile?.available !== undefined && profile?.available !== null },
          { label: "Social Media",          ok: !!(profile?.instagram_url || profile?.youtube_url || profile?.linkedin_url || profile?.tiktok_url) },
        ];
        const filled = checks.filter((c) => c.ok).length;
        setProfileCompleteness(Math.round((filled / checks.length) * 100));
        setProfileMissingFields(checks.filter((c) => !c.ok).map((c) => c.label));
      })
      .catch(() => {});

    // Profilaufrufe
    fetch("/api/profile-views")
      .then((r) => r.json())
      .then((data) => setViewStats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== "listings" && activeTab !== "overview" && activeTab !== "analytics") return;
    setListingsLoading(true);
    fetch("/api/listings?mine=true")
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (error) { setListingsError(error); return; }
        setMyListings(data ?? []);
      })
      .catch(() => setListingsError("Fehler beim Laden"))
      .finally(() => setListingsLoading(false));
  }, [activeTab]);

  const togglePublished = async (id: string, current: boolean) => {
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !current }),
    });
    setMyListings((prev) => prev.map((l) => l.id === id ? { ...l, published: !current } : l));
  };

  const deleteListing = async (id: string) => {
    if (!confirm("Inserat wirklich löschen?")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    setMyListings((prev) => prev.filter((l) => l.id !== id));
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", city: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const startEdit = (l: typeof myListings[number]) => {
    setEditingId(l.id);
    setEditForm({ title: l.title, description: l.description ?? "", price: String(l.price), city: l.city });
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.title.trim() || !editForm.city.trim()) {
      setEditError("Titel und Stadt sind Pflichtfelder");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/listings/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description,
          price: parseFloat(editForm.price) || 0,
          city: editForm.city.trim(),
        }),
      });
      const { error } = await res.json();
      if (error) throw new Error(error);
      setMyListings((prev) => prev.map((l) =>
        l.id === editingId
          ? { ...l, title: editForm.title.trim(), description: editForm.description, city: editForm.city.trim(), price: parseFloat(editForm.price) || 0 }
          : l
      ));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setEditSaving(false);
    }
  };

  const typeLabel: Record<string, string> = {
    location: "Drehort",
    prop: "Marktplatz",
    vehicle: "Fahrzeug",
    job: "Job",
    creator: "Crew / Profil",
  };

  const typeHref = (l: { id: string; type: string }) => {
    if (l.type === "location") return `/locations/${l.id}`;
    if (l.type === "prop") return `/props/${l.id}`;
    if (l.type === "vehicle") return `/vehicles/${l.id}`;
    if (l.type === "job") return `/jobs/${l.id}`;
    if (l.type === "creator") return `/creators/${l.id}`;
    return "#";
  };
  const { user } = useUser();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const [applications, setApplications] = useState<{ id: string; job_id: string; job_title: string; status: string; day_rate: string | null; created_at: string }[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  // Company
  type MyCompany = {
    id: string; slug: string; name: string; logo_url: string | null;
    published: boolean; categories: string[]; city: string | null;
    tagline: string | null; description: string | null;
    social_links: Record<string, string> | null;
  };
  const [myCompany, setMyCompany] = useState<MyCompany | null | "loading">("loading");

  useEffect(() => {
    fetch("/api/companies?mine=true")
      .then(r => r.json())
      .then(({ data }) => setMyCompany(data?.[0] ?? null))
      .catch(() => setMyCompany(null));
  }, []);

  // My posted jobs
  const [myJobs, setMyJobs] = useState<{ id: string; title: string; published: boolean; role: string | null; location: string | null; employment_type: string | null; created_at: string }[]>([]);
  const [myJobsLoading, setMyJobsLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "jobs" && activeTab !== "overview") return;
    setMyJobsLoading(true);
    fetch("/api/listings?mine=true")
      .then(r => r.json())
      .then(({ data }) => setMyJobs((data ?? []).filter((l: { type: string }) => l.type === "job")))
      .catch(() => {})
      .finally(() => setMyJobsLoading(false));
  }, [activeTab]);

  // Favorites
  type Favorite = {
    id: string; listing_id: string; listing_type: string;
    listing_title: string | null; listing_city: string | null;
    listing_price: number | null; listing_image: string | null; created_at: string;
  };
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [removingFav, setRemovingFav] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "favorites" && activeTab !== "overview") return;
    if (favorites.length > 0) return;
    setFavoritesLoading(true);
    fetch("/api/favorites")
      .then(r => r.json())
      .then(({ favorites: data }) => setFavorites(data ?? []))
      .catch(() => {})
      .finally(() => setFavoritesLoading(false));
  }, [activeTab]);

  const removeFavorite = async (fav: Favorite) => {
    setRemovingFav(fav.listing_id);
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: fav.listing_id, listing_type: fav.listing_type }),
      });
      setFavorites(prev => prev.filter(f => f.listing_id !== fav.listing_id));
    } finally {
      setRemovingFav(null);
    }
  };

  const favTypeConfig: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; href: (id: string) => string; color: string }> = {
    location: { label: "Drehort",    icon: MapPin,    href: (id) => `/locations/${id}`, color: "text-sky-400" },
    vehicle:  { label: "Fahrzeug",   icon: Car,       href: (id) => `/vehicles/${id}`,  color: "text-orange-400" },
    prop:     { label: "Requisite",  icon: Package,   href: (id) => `/props/${id}`,     color: "text-violet-400" },
    job:      { label: "Job",        icon: Briefcase, href: (id) => `/jobs/${id}`,      color: "text-emerald-400" },
    creator:  { label: "Filmschaffende/r", icon: User, href: (id) => `/creators/${id}`, color: "text-gold" },
  };

  // Friends
  type FriendEntry = { friendship_id: string; user_id: string; display_name: string; avatar_url: string | null; role: string };
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendsIncoming, setFriendsIncoming] = useState<FriendEntry[]>([]);
  const [friendsOutgoing, setFriendsOutgoing] = useState<FriendEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsTab, setFriendsTab] = useState<"friends" | "incoming" | "outgoing">("incoming");

  const doLoadFriends = (showSpinner: boolean) => {
    if (showSpinner) setFriendsLoading(true);
    fetch("/api/friendships")
      .then(r => r.json())
      .then(({ friends: f, incoming: i, outgoing: o }) => {
        setFriends(f ?? []);
        setFriendsIncoming(i ?? []);
        setFriendsOutgoing(o ?? []);
      })
      .catch(() => {})
      .finally(() => setFriendsLoading(false));
  };

  // Load on mount for sidebar badge
  useEffect(() => { doLoadFriends(false); }, []);

  // Reload with spinner when the friends tab is opened
  useEffect(() => {
    if (activeTab !== "friends") return;
    doLoadFriends(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const acceptFriend = async (id: string) => {
    await fetch(`/api/friendships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    doLoadFriends(true);
  };

  const rejectFriend = async (id: string) => {
    await fetch(`/api/friendships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    doLoadFriends(true);
  };

  const removeFriendEntry = async (id: string) => {
    await fetch(`/api/friendships/${id}`, { method: "DELETE" });
    doLoadFriends(true);
  };

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState<{ profile_visibility: string; message_permission: string }>({
    profile_visibility: "public",
    message_permission: "everyone",
  });
  const [privacyLoading, setPrivacyLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "settings") return;
    fetch("/api/user-settings")
      .then(r => r.json())
      .then(({ settings }) => { if (settings) setPrivacySettings(settings); })
      .catch(() => {});
  }, [activeTab]);

  const updatePrivacy = async (key: string, value: string) => {
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
    setPrivacyLoading(true);
    try {
      await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } finally {
      setPrivacyLoading(false);
    }
  };

  const [conversations, setConversations] = useState<RealConversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<RealMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== "bookings" && activeTab !== "earnings" && activeTab !== "transactions" && activeTab !== "overview") return;
    setBookingsLoading(true);
    fetch("/api/bookings")
      .then(r => r.json())
      .then(({ bookings: data }) => setBookings(data ?? []))
      .catch(() => {})
      .finally(() => setBookingsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "bookings") return;
    setApplicationsLoading(true);
    fetch("/api/applications")
      .then(r => r.json())
      .then(({ applications: data }) => setApplications(data ?? []))
      .catch(() => {})
      .finally(() => setApplicationsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "messages" && activeTab !== "overview" && activeTab !== "analytics" && activeTab !== "bookings") return;
    setConvsLoading(true);
    fetch("/api/conversations")
      .then(r => r.json())
      .then(({ data }) => setConversations(data ?? []))
      .catch(() => {})
      .finally(() => setConvsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (!selectedConversation) return;
    setMessagesLoading(true);
    fetch(`/api/conversations/${selectedConversation}`)
      .then(r => r.json())
      .then(({ messages }) => {
        setActiveMessages(messages ?? []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
  }, [selectedConversation]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConversation || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText("");
    try {
      await fetch(`/api/conversations/${selectedConversation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const { messages } = await fetch(`/api/conversations/${selectedConversation}`).then(r => r.json());
      setActiveMessages(messages ?? []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      // refresh conv list to update updated_at
      fetch("/api/conversations").then(r => r.json()).then(({ data }) => setConversations(data ?? []));
    } finally {
      setSending(false);
    }
  };

  const formatMsgTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Gerade eben";
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `vor ${diffH} Std.`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "Gestern";
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  };

  const unreadCount = conversations.filter(c =>
    c.messages.some(m => m.sender_id !== user?.id && !m.read_at)
  ).length;

  const tabTitle = () => {
    const map: Record<string, string> = {
      overview: "Dashboard-Übersicht",
      profil: "Mein Profil",
      firma: "Meine Firma",
      listings: "Meine Inserate",
      jobs: "Jobs verwalten",
      bookings: "Buchungen",
      earnings: "Einnahmen",
      payouts: "Auszahlungen",
      transactions: "Transaktionen",
      messages: "Nachrichten",
      analytics: "Analysen",
      favorites: "Merkliste",
      friends: "Freunde",
      settings: "Einstellungen",
    };
    return map[activeTab] ?? activeTab;
  };

  return (
    <ProfileGuard>
    <div className="pt-16 min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 border-r border-border bg-bg-secondary flex-col fixed left-0 top-16 bottom-0 z-40">
        {/* Profil-Karte */}
        <div className="p-4 border-b border-border">
          {/* Avatar + Name */}
          {(() => {
            const avatarSrc = profileAvatarUrl || user?.imageUrl || "";
            const displayName = profileDisplayName || (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "") || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "—";
            const initial = displayName[0]?.toUpperCase() ?? "?";
            return (
              <div className="flex items-center gap-3 mb-3">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gold/20 border-2 border-gold/30 flex items-center justify-center shrink-0">
                    <span className="text-gold font-bold text-base">{initial}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate leading-tight">{displayName}</p>
                  <p className="text-xs text-text-muted truncate mt-0.5">{profileRole || "CineGenius Mitglied"}</p>
                </div>
              </div>
            );
          })()}
          {/* Profil-Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href={user?.id ? `/creators/${user.id}` : "/creators"}
              className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium border border-border text-text-secondary rounded-md hover:border-gold hover:text-gold transition-all"
            >
              <Eye size={10} /> Ansehen
            </Link>
            <Link
              href="/profile"
              className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium border border-gold/30 text-gold bg-gold/5 rounded-md hover:bg-gold/15 transition-all"
            >
              <Pencil size={10} /> Bearbeiten
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-gold-subtle text-gold border-l-2 border-gold pl-2.5"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              }`}
            >
              <Icon size={16} />
              {label}
              {id === "messages" && unreadCount > 0 && (
                <span className="ml-auto w-5 h-5 bg-crimson text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
              {id === "favorites" && favorites.length > 0 && (
                <span className="ml-auto text-[10px] text-text-muted font-medium">{favorites.length}</span>
              )}
              {id === "friends" && friendsIncoming.length > 0 && (
                <span className="ml-auto w-5 h-5 bg-gold text-bg-primary text-xs rounded-full flex items-center justify-center">
                  {friendsIncoming.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-xs font-semibold text-success mb-1 flex items-center gap-1">
              <CheckCircle size={11} /> Kostenlos nutzen
            </p>
            <p className="text-xs text-text-muted">10% Provision nur bei Erfolg</p>
          </div>
        </div>
      </aside>

      {/* Hauptinhalt */}
      <div className="flex-1 lg:ml-60">
        {/* Top-Leiste */}
        <div className="sticky top-16 z-30 bg-bg-primary/80 backdrop-blur-nav border-b border-border px-6 py-3 flex items-center justify-between">
          <h1 className="font-display text-base font-bold text-text-primary">{tabTitle()}</h1>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={() => setActiveTab("messages")} className="relative w-8 h-8 flex items-center justify-center text-text-secondary hover:text-gold transition-colors">
                <MessageSquare size={16} />
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-gold text-bg-primary text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              </button>
            )}
            <Link href="/inserat" className="px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">
              <Plus size={13} /> Neues Inserat
            </Link>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden overflow-x-auto border-b border-border bg-bg-secondary">
          <div className="flex gap-0.5 px-2 py-1.5 min-w-max">
            {navItems.map(({ icon: Icon, label, id }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === id
                    ? "bg-gold-subtle text-gold"
                    : "text-text-secondary hover:text-gold hover:bg-bg-elevated"
                }`}
              >
                <Icon size={13} />
                {label}
                {id === "messages" && unreadCount > 0 && (
                  <span className="w-4 h-4 bg-crimson text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
                {id === "friends" && friendsIncoming.length > 0 && (
                  <span className="w-4 h-4 bg-gold text-bg-primary text-[10px] rounded-full flex items-center justify-center font-bold">
                    {friendsIncoming.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* ── ÜBERSICHT ── */}
          {activeTab === "overview" && (
            <div className="space-y-8 max-w-4xl">

              {/* ── Begrüßung ── */}
              <div>
                <h2 className="font-display text-2xl font-bold text-text-primary">
                  Hallo, {profileDisplayName || user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || ""}
                </h2>
                <p className="text-text-muted text-sm mt-1">
                  {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>

              {/* ── Stats-Kacheln ── */}
              {viewStats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">
                      <Eye size={12} /> Profilaufrufe
                    </p>
                    <p className="text-2xl font-bold font-mono text-text-primary">{viewStats.views7}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-xs font-medium ${viewStats.trend > 0 ? "text-success" : viewStats.trend < 0 ? "text-red-400" : "text-text-muted"}`}>
                        {viewStats.trend > 0 ? `+${viewStats.trend}%` : viewStats.trend < 0 ? `${viewStats.trend}%` : "—"}
                      </span>
                      <span className="text-xs text-text-muted">vs. Vorwoche</span>
                    </div>
                    {/* Sparkline */}
                    <div className="flex items-end gap-0.5 mt-3 h-8">
                      {viewStats.daily.map((v, i) => {
                        const max = Math.max(...viewStats.daily, 1);
                        return (
                          <div key={i} className="flex-1 bg-gold/30 rounded-sm transition-all hover:bg-gold/60"
                            style={{ height: `${Math.max((v / max) * 100, 8)}%` }} />
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">Letzte 7 Tage</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">
                      <List size={12} /> Aktive Inserate
                    </p>
                    <p className="text-2xl font-bold font-mono text-text-primary">
                      {myListings.filter((l) => l.published).length}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      von {myListings.length} gesamt
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">
                      <MessageSquare size={12} /> Nachrichten
                    </p>
                    <p className="text-2xl font-bold font-mono text-text-primary">{unreadCount}</p>
                    <p className="text-xs text-text-muted mt-1">ungelesen</p>
                  </div>
                </div>
              )}

              {/* ── Primäre CTA ── */}
              {!listingsLoading && myListings.length === 0 ? (
                <Link
                  href="/inserat"
                  className="group flex items-center gap-5 p-6 rounded-2xl border-2 border-gold/40 bg-gold-subtle hover:border-gold hover:bg-gold/10 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold text-bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Plus size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-text-primary">Erstelle dein erstes Inserat</p>
                    <p className="text-sm text-text-muted mt-0.5">Drehort, Job, Fahrzeug oder Equipment — kostenlos inserieren</p>
                  </div>
                  <ChevronRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : !user?.imageUrl ? (
                <Link
                  href="/profile"
                  className="group flex items-center gap-5 p-6 rounded-2xl border-2 border-gold/40 bg-gold-subtle hover:border-gold hover:bg-gold/10 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold text-bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <User size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-text-primary">Profil vervollständigen</p>
                    <p className="text-sm text-text-muted mt-0.5">Profilbild, Bio und Fähigkeiten hinzufügen — werde sichtbar</p>
                  </div>
                  <ChevronRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : unreadCount > 0 ? (
                <button
                  onClick={() => setActiveTab("messages")}
                  className="group w-full flex items-center gap-5 p-6 rounded-2xl border-2 border-gold/40 bg-gold-subtle hover:border-gold hover:bg-gold/10 transition-all text-left"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold text-bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform relative">
                    <MessageSquare size={26} />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-crimson text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-text-primary">{unreadCount} neue Nachricht{unreadCount !== 1 ? "en" : ""}</p>
                    <p className="text-sm text-text-muted mt-0.5">Jemand hat dir geschrieben — jetzt antworten</p>
                  </div>
                  <ChevronRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : null}

              {/* ── Profilstärke ── */}
              {profileCompleteness < 100 && (
                <div className="p-5 rounded-2xl border border-border bg-bg-secondary">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Profilstärke</p>
                      <p className="text-xs text-text-muted mt-0.5">Vollständige Profile werden häufiger gebucht</p>
                    </div>
                    <span className={`text-lg font-bold font-mono ${profileCompleteness >= 75 ? "text-success" : profileCompleteness >= 50 ? "text-gold" : "text-text-secondary"}`}>
                      {profileCompleteness}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${profileCompleteness >= 75 ? "bg-success" : profileCompleteness >= 50 ? "bg-gold" : "bg-text-muted"}`}
                      style={{ width: `${profileCompleteness}%` }}
                    />
                  </div>
                  {profileMissingFields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profileMissingFields.slice(0, 4).map((f) => (
                        <span key={f} className="px-2 py-0.5 bg-bg-elevated border border-border text-xs text-text-muted rounded-full">
                          + {f}
                        </span>
                      ))}
                      {profileMissingFields.length > 4 && (
                        <span className="px-2 py-0.5 text-xs text-text-muted">+{profileMissingFields.length - 4} weitere</span>
                      )}
                    </div>
                  )}
                  <Link href="/profile" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-light transition-colors">
                    Profil vervollständigen <ChevronRight size={12} />
                  </Link>
                </div>
              )}

              {/* ── Meine Inserate ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-text-primary">Meine Inserate</h3>
                  <div className="flex items-center gap-2">
                    {myListings.length > 0 && (
                      <button onClick={() => setActiveTab("listings")} className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">
                        Alle verwalten <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {listingsLoading && (
                  <div className="flex items-center gap-3 text-sm text-text-muted py-4">
                    <Loader2 size={16} className="animate-spin" /> Lädt...
                  </div>
                )}

                {!listingsLoading && myListings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border text-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
                      <List size={20} className="text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary">Noch keine Inserate</p>
                      <p className="text-xs text-text-muted mt-0.5">Deine Inserate erscheinen hier sobald du eins erstellst</p>
                    </div>
                    <Link href="/inserat" className="mt-1 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-1.5">
                      <Plus size={12} /> Inserat erstellen
                    </Link>
                  </div>
                )}

                {!listingsLoading && myListings.length > 0 && (
                  <div className="space-y-3">
                    {myListings.slice(0, 4).map((l) => (
                      <Link key={l.id} href={typeHref(l)} className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated transition-all">
                        {/* Bild */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-bg-elevated border border-border">
                          {l.image_url ? (
                            <img src={l.image_url} alt={l.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {l.type === "location" ? "📍" : l.type === "vehicle" ? "🚗" : l.type === "job" ? "💼" : l.type === "creator" ? "🎬" : "📦"}
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{l.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-semibold ${l.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border"}`}>
                              {l.published ? "Aktiv" : "Inaktiv"}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted">{typeLabel[l.type] ?? l.type} · {l.city}</p>
                        </div>
                        {/* Preis */}
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-gold font-display">
                            {l.price > 0 ? `${l.price.toLocaleString()} €` : "—"}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">/Tag</p>
                        </div>
                        <ChevronRight size={14} className="text-text-muted group-hover:text-gold transition-colors shrink-0" />
                      </Link>
                    ))}
                    {myListings.length > 4 && (
                      <button onClick={() => setActiveTab("listings")} className="w-full py-3 rounded-xl border border-dashed border-border text-xs text-text-muted hover:border-gold hover:text-gold transition-colors">
                        + {myListings.length - 4} weitere Inserate anzeigen
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Nachrichten & Anfragen (kombiniert) ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-text-primary">
                    Nachrichten & Anfragen
                    {unreadCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-gold text-bg-primary font-bold rounded-full">{unreadCount}</span>
                    )}
                  </h3>
                  {conversations.length > 0 && (
                    <button onClick={() => setActiveTab("messages")} className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">
                      Alle öffnen <ChevronRight size={12} />
                    </button>
                  )}
                </div>

                {convsLoading && (
                  <div className="flex items-center gap-3 text-sm text-text-muted py-4">
                    <Loader2 size={16} className="animate-spin" /> Lädt...
                  </div>
                )}

                {!convsLoading && conversations.length === 0 && (
                  <div className="flex items-center gap-4 p-5 rounded-xl border border-dashed border-border text-text-muted">
                    <MessageSquare size={20} className="shrink-0 opacity-40" />
                    <p className="text-sm">Noch keine Nachrichten — sobald jemand schreibt, erscheint es hier.</p>
                  </div>
                )}

                {!convsLoading && conversations.length > 0 && (
                  <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden divide-y divide-border">
                    {conversations.slice(0, 5).map((conv) => {
                      const lastMsg = conv.messages[conv.messages.length - 1];
                      const hasUnread = conv.messages.some(m => m.sender_id !== user?.id && !m.read_at);
                      return (
                        <button
                          key={conv.id}
                          onClick={() => { setActiveTab("messages"); setSelectedConversation(conv.id); }}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors text-left"
                        >
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                              <User size={15} className="text-gold" />
                            </div>
                            {hasUnread && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gold rounded-full border-2 border-bg-secondary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${hasUnread ? "text-text-primary" : "text-text-secondary"}`}>
                              {conv.listing_title ?? "Nachricht"}
                            </p>
                            <p className="text-xs text-text-muted truncate mt-0.5">{lastMsg?.content ?? "…"}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {hasUnread && (
                              <span className="inline-block mb-1 px-1.5 py-0.5 text-[10px] bg-gold text-bg-primary font-bold rounded-full">Neu</span>
                            )}
                            <p className="text-[10px] text-text-muted">{formatMsgTime(conv.updated_at)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Firmenprofil ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-text-primary">Firmenprofil</h3>
                  <button onClick={() => setActiveTab("firma")} className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">
                    Verwalten <ChevronRight size={12} />
                  </button>
                </div>
                {myCompany === "loading" && (
                  <div className="flex items-center gap-3 text-sm text-text-muted py-4">
                    <Loader2 size={16} className="animate-spin" /> Lädt...
                  </div>
                )}
                {myCompany === null && (
                  <button onClick={() => setActiveTab("firma")}
                    className="group flex items-center gap-4 w-full p-4 rounded-xl border border-dashed border-border hover:border-gold/40 hover:bg-bg-elevated transition-all text-left">
                    <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-text-muted group-hover:text-gold transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">Kein Firmenprofil vorhanden</p>
                      <p className="text-xs text-text-muted mt-0.5">Firmenprofil erstellen → Werde sichtbar für Produktionen</p>
                    </div>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-gold transition-colors ml-auto shrink-0" />
                  </button>
                )}
                {myCompany && myCompany !== "loading" && (
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 hover:bg-bg-elevated transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {myCompany.logo_url
                        ? <img src={myCompany.logo_url} alt={myCompany.name} className="w-full h-full object-contain p-1" />
                        : <Building2 size={20} className="text-text-muted opacity-40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-text-primary text-sm truncate">{myCompany.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-semibold ${myCompany.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border"}`}>
                          {myCompany.published ? "Aktiv" : "Entwurf"}
                        </span>
                      </div>
                      {myCompany.city && <p className="text-xs text-text-muted">{myCompany.city}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => setActiveTab("firma")} className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all">Verwalten</button>
                      <a href={`/companies/${myCompany.slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center flex items-center gap-1 justify-center">
                        <ExternalLink size={10} /> Ansehen
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Schnellzugriff ── */}
              <div>
                <h3 className="font-display text-lg font-bold text-text-primary mb-4">Schnellzugriff</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: User,         label: "Mein Profil",  sub: `${profileCompleteness}% vollständig`, id: "profil" },
                    { icon: Calendar,     label: "Buchungen",    sub: bookings.length > 0 ? `${bookings.length} gesamt` : "Keine", id: "bookings" },
                    { icon: MessageSquare,label: "Nachrichten",  sub: unreadCount > 0 ? `${unreadCount} ungelesen` : "Alle gelesen", id: "messages" },
                    { icon: BarChart2,    label: "Analysen",     sub: `${conversations.length} Anfragen`, id: "analytics" },
                  ].map(({ icon: Icon, label, sub, id }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                        <Icon size={15} className="text-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{label}</p>
                        <p className="text-xs text-text-muted mt-0.5">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── PROFIL ── */}
          {activeTab === "profil" && (
            <div className="space-y-6 max-w-2xl">
              {/* Header */}
              {(() => {
                const avatarSrc = profileAvatarUrl || user?.imageUrl || "";
                const displayName = profileDisplayName || (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "") || "—";
                return (
                  <div className="flex items-start gap-5 p-6 rounded-2xl border border-border bg-bg-secondary">
                    <div className="shrink-0">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gold/30" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gold/20 border-2 border-gold/30 flex items-center justify-center">
                          <span className="text-gold font-bold text-xl">{displayName[0]?.toUpperCase() ?? "?"}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg font-bold text-text-primary leading-tight">{displayName}</p>
                      <p className="text-sm text-text-muted mt-0.5 mb-4">{profileRole || "CineGenius Mitglied"}</p>
                      <div className="flex flex-wrap gap-2">
                        <a href="/profile" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">
                          <Pencil size={12} /> Profil bearbeiten
                        </a>
                        <a href={user?.id ? `/profile/${user.id}` : "/creators"} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">
                          <ExternalLink size={12} /> Öffentlich ansehen
                        </a>
                        <a href="/creators" className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">
                          <Eye size={12} /> Im Crew-Verzeichnis
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Vollständigkeit */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Profilstärke</p>
                    <p className="text-xs text-text-muted mt-0.5">Vollständige Profile werden häufiger entdeckt</p>
                  </div>
                  <span className={`text-xl font-bold font-mono ${profileCompleteness >= 75 ? "text-success" : profileCompleteness >= 50 ? "text-gold" : "text-text-secondary"}`}>
                    {profileCompleteness}%
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden mb-4">
                  <div className={`h-full rounded-full transition-all duration-700 ${profileCompleteness >= 75 ? "bg-success" : profileCompleteness >= 50 ? "bg-gold" : "bg-text-muted"}`}
                    style={{ width: `${profileCompleteness}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profileMissingFields.map((f) => (
                    <a key={f} href="/profile"
                      className="flex items-center gap-2 text-xs text-text-muted hover:text-gold transition-colors group">
                      <AlertCircle size={12} className="shrink-0 group-hover:text-gold" />
                      <span>{f} fehlt noch</span>
                    </a>
                  ))}
                  {profileMissingFields.length === 0 && (
                    <p className="flex items-center gap-2 text-xs text-success col-span-2">
                      <CheckCircle size={12} /> Profil vollständig ausgefüllt
                    </p>
                  )}
                </div>
              </div>

              {/* Profilaufrufe */}
              {viewStats && (
                <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                  <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Eye size={15} className="text-gold" /> Profilaufrufe (letzte 7 Tage)
                  </p>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-3xl font-bold font-display text-text-primary">{viewStats.views7}</p>
                      <p className={`text-xs font-medium mt-1 ${viewStats.trend > 0 ? "text-success" : viewStats.trend < 0 ? "text-red-400" : "text-text-muted"}`}>
                        {viewStats.trend > 0 ? `+${viewStats.trend}%` : viewStats.trend < 0 ? `${viewStats.trend}%` : "Keine Änderung"} vs. Vorwoche
                      </p>
                    </div>
                    <div className="flex items-end gap-0.5 h-10 flex-1">
                      {viewStats.daily.map((v, i) => {
                        const max = Math.max(...viewStats.daily, 1);
                        return <div key={i} className="flex-1 bg-gold/30 rounded-sm hover:bg-gold/60" style={{ height: `${Math.max((v / max) * 100, 8)}%` }} />;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Schnelle Felder-Übersicht */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-text-primary">Checkliste</p>
                  <a href="/profile" className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">
                    Alle bearbeiten <ChevronRight size={11} />
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: "Anzeigename",           ok: !!profileDisplayName },
                    { label: "Profilfoto",            ok: !!(profileAvatarUrl || user?.imageUrl) },
                    { label: "Bio / Über mich",       ok: !!profileMissingFields && !profileMissingFields.includes("Über mich / Bio") },
                    { label: "Standort",              ok: !profileMissingFields.includes("Standort") },
                    { label: "Position / Rolle",      ok: !profileMissingFields.includes("Position / Rolle") },
                    { label: "Showreel",              ok: !profileMissingFields.includes("Showreel / Reel-Link") },
                    { label: "Tagessatz",             ok: !profileMissingFields.includes("Tagessatz") },
                    { label: "Filmografie",           ok: !profileMissingFields.includes("Filmografie") },
                    { label: "Social Media",          ok: !profileMissingFields.includes("Social Media") },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      {ok
                        ? <CheckCircle size={12} className="text-success shrink-0" />
                        : <AlertCircle size={12} className="text-text-muted shrink-0" />}
                      <span className={ok ? "text-text-secondary" : "text-text-muted"}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── FIRMA ── */}
          {activeTab === "firma" && (
            <div className="space-y-6 max-w-2xl">
              {myCompany === "loading" && (
                <div className="flex items-center gap-3 text-sm text-text-muted py-8">
                  <Loader2 size={16} className="animate-spin" /> Lädt...
                </div>
              )}

              {myCompany === null && (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl space-y-4">
                  <div className="w-16 h-16 mx-auto bg-bg-secondary border border-border rounded-2xl flex items-center justify-center">
                    <Building2 size={28} className="text-text-muted opacity-40" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-text-primary mb-2">Kein Firmenprofil vorhanden</h3>
                    <p className="text-sm text-text-muted max-w-sm mx-auto">
                      Erstelle ein Firmenprofil für deine Produktionsfirma, Agentur oder deinen Service-Betrieb — und werde für andere Filmschaffende auffindbar.
                    </p>
                  </div>
                  <a href="/company-setup"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors">
                    <Plus size={16} /> Firmenprofil erstellen
                  </a>
                </div>
              )}

              {myCompany && myCompany !== "loading" && (
                <>
                  {/* Company Header */}
                  <div className="flex items-start gap-5 p-6 rounded-2xl border border-border bg-bg-secondary">
                    <div className="w-16 h-16 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {myCompany.logo_url
                        ? <img src={myCompany.logo_url} alt={myCompany.name} className="w-full h-full object-contain p-1.5" />
                        : <Building2 size={24} className="text-text-muted opacity-40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-display text-lg font-bold text-text-primary">{myCompany.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${myCompany.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border"}`}>
                          {myCompany.published ? "Veröffentlicht" : "Entwurf"}
                        </span>
                      </div>
                      {myCompany.city && <p className="text-xs text-text-muted mb-3">{myCompany.city}</p>}
                      {myCompany.tagline && <p className="text-sm text-text-secondary italic mb-3">&ldquo;{myCompany.tagline}&rdquo;</p>}
                      <div className="flex flex-wrap gap-2">
                        <a href="/company-setup"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">
                          <Pencil size={12} /> Profil bearbeiten
                        </a>
                        <a href="/company-dashboard"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">
                          <BarChart2 size={12} /> Firmen-Dashboard
                        </a>
                        <a href={`/companies/${myCompany.slug}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">
                          <ExternalLink size={12} /> Öffentlich ansehen
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Checkliste */}
                  <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-sm font-semibold text-text-primary mb-3">Profil-Vollständigkeit</p>
                    <div className="space-y-2">
                      {[
                        { label: "Logo hochgeladen",          done: !!myCompany.logo_url },
                        { label: "Tagline / Beschreibung",    done: !!(myCompany.tagline?.trim() || myCompany.description?.trim()) },
                        { label: "Social Media hinterlegt",   done: !!(myCompany.social_links && Object.values(myCompany.social_links).some(v => v?.trim())) },
                        { label: "Profil veröffentlicht",     done: myCompany.published },
                      ].map(({ label, done }) => (
                        <div key={label} className="flex items-center gap-2 text-sm">
                          {done
                            ? <CheckCircle size={14} className="text-success shrink-0" />
                            : <AlertCircle size={14} className="text-text-muted shrink-0" />}
                          <span className={done ? "text-text-secondary" : "text-text-muted"}>{label}</span>
                          {!done && (
                            <a href="/company-setup" className="ml-auto text-xs text-gold hover:underline">Ergänzen →</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Links */}
                  <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-sm font-semibold text-text-primary mb-3">Erweiterte Verwaltung</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { label: "Services verwalten",    href: "/company-dashboard?tab=services",  desc: "Dienstleistungen hinzufügen & bearbeiten" },
                        { label: "Equipment verwalten",   href: "/company-dashboard?tab=equipment", desc: "Verleih & technisches Equipment" },
                        { label: "Team verwalten",        href: "/company-dashboard?tab=team",      desc: "Mitglieder einladen & Rollen vergeben" },
                        { label: "Firmenprofil bearbeiten", href: "/company-setup",                 desc: "Name, Logo, Beschreibung, Social" },
                      ].map(({ label, href, desc }) => (
                        <a key={label} href={href}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-bg-elevated transition-all group">
                          <ChevronRight size={14} className="text-text-muted group-hover:text-gold mt-0.5 shrink-0 transition-colors" />
                          <div>
                            <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">{label}</p>
                            <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── JOBS VERWALTEN ── */}
          {activeTab === "jobs" && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  {myJobsLoading ? "Lädt..." : (
                    <><span className="text-text-primary font-semibold">{myJobs.length}</span> {myJobs.length === 1 ? "Job" : "Jobs"} ausgeschrieben</>
                  )}
                </p>
                <a href="/inserat" className="px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">
                  <Plus size={12} /> Job ausschreiben
                </a>
              </div>

              {myJobsLoading && (
                <div className="flex items-center gap-3 text-sm text-text-muted py-4">
                  <Loader2 size={16} className="animate-spin" /> Lädt...
                </div>
              )}

              {!myJobsLoading && myJobs.length === 0 && (
                <div className="text-center py-14 border border-dashed border-border rounded-2xl space-y-4">
                  <div className="w-14 h-14 mx-auto bg-bg-secondary border border-border rounded-2xl flex items-center justify-center">
                    <Briefcase size={24} className="text-text-muted opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Noch keine Jobs ausgeschrieben</p>
                    <p className="text-xs text-text-muted mt-1">Suche Darsteller, Crew oder Locations? Schreibe jetzt einen Job aus.</p>
                  </div>
                  <a href="/inserat" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">
                    <Plus size={13} /> Job ausschreiben
                  </a>
                </div>
              )}

              {!myJobsLoading && myJobs.map((job) => (
                <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-elevated transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    <Briefcase size={16} className="text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-semibold text-sm text-text-primary truncate">{job.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 border rounded-full shrink-0 font-semibold ${job.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border"}`}>
                        {job.published ? "Aktiv" : "Entwurf"}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {[job.role, job.location].filter(Boolean).join(" · ")} · {new Date(job.created_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <a href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center">
                      Ansehen
                    </a>
                    <a href={`/jobs/${job.id}/edit`}
                      className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center flex items-center gap-1 justify-center">
                      <Pencil size={10} /> Bearbeiten
                    </a>
                  </div>
                </div>
              ))}

              {/* Bewerbungen auf eigene Jobs */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden mt-6">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary text-sm">Eingegangene Bewerbungen</h3>
                </div>
                <div className="p-8 text-center space-y-2">
                  <FileText size={24} className="mx-auto text-text-muted opacity-20" />
                  <p className="text-sm text-text-muted">Bewerbungen auf deine Jobs erscheinen hier</p>
                  <p className="text-xs text-text-muted">Feature folgt demnächst</p>
                </div>
              </div>
            </div>
          )}

          {/* ── INSERATE ── */}
          {activeTab === "listings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  {listingsLoading ? "Lädt..." : (
                    <><span className="text-text-primary font-semibold">{myListings.length}</span> {myListings.length === 1 ? "Inserat" : "Inserate"}</>
                  )}
                </p>
                <Link href="/inserat" className="px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">
                  <Plus size={12} /> Inserat hinzufügen
                </Link>
              </div>

              {listingsError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{listingsError}</p>
              )}

              {!listingsLoading && myListings.length === 0 && !listingsError && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <p className="text-text-muted mb-4">Noch keine Inserate. Erstelle dein erstes!</p>
                  <Link href="/inserat" className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors inline-flex items-center gap-2">
                    <Plus size={14} /> Inserat erstellen
                  </Link>
                </div>
              )}

              {myListings.map((l) => (
                <div key={l.id}>
                <div className={`flex items-center gap-4 p-5 rounded-xl border bg-bg-secondary transition-colors ${editingId === l.id ? "border-gold/30" : "border-border hover:bg-bg-elevated"}`}>
                  <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-2xl">
                    {l.type === "location" ? "📍" : l.type === "vehicle" ? "🚗" : l.type === "job" ? "💼" : l.type === "creator" ? "🎬" : "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-text-primary">{l.title}</h3>
                      <span className={`text-xs px-2 py-0.5 border rounded ${l.published ? "bg-success/10 text-success border-success/20" : "bg-border text-text-muted border-border"}`}>
                        {l.published ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mb-1">{typeLabel[l.type] ?? l.type} · {l.city}</p>
                    <p className="text-xs text-text-muted">
                      {l.price > 0 ? `${l.price.toLocaleString()} € / Tag` : "Preis auf Anfrage"} ·{" "}
                      erstellt {new Date(l.created_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      href={typeHref(l)}
                      className="px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:border-gold hover:text-gold rounded-md transition-all text-center"
                    >
                      Ansehen
                    </Link>
                    <button
                      onClick={() => editingId === l.id ? setEditingId(null) : startEdit(l)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                        editingId === l.id
                          ? "border border-gold bg-gold/10 text-gold"
                          : "border border-border text-text-secondary hover:border-gold hover:text-gold"
                      }`}
                    >
                      <Pencil size={10} /> Bearbeiten
                    </button>
                    <button
                      onClick={() => togglePublished(l.id, l.published)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        l.published
                          ? "border border-gold/30 text-gold hover:bg-gold/10"
                          : "border border-success/30 text-success hover:bg-success/10"
                      }`}
                    >
                      {l.published ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button
                      onClick={() => deleteListing(l.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                    >
                      Löschen
                    </button>
                  </div>
                </div>

                {/* ── Inline Edit Panel ── */}
                {editingId === l.id && (
                  <div className="mt-3 p-4 rounded-xl border border-gold/20 bg-gold/5 space-y-3">
                    <p className="text-xs font-semibold text-gold uppercase tracking-widest">Inserat bearbeiten</p>
                    {editError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{editError}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">Titel *</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
                          placeholder="Titel des Inserats"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">Stadt *</label>
                        <input
                          type="text"
                          value={editForm.city}
                          onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
                          placeholder="z. B. Berlin"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">Preis / Tag (€)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.price}
                        onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
                        placeholder="z. B. 500"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">Beschreibung</label>
                      <textarea
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                        placeholder="Beschreibe dein Inserat…"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-xs font-medium border border-border text-text-secondary hover:text-text-primary rounded-lg transition-all"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={editSaving}
                        className="px-4 py-2 text-xs font-semibold bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {editSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Speichern
                      </button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}

          {/* ── NACHRICHTEN ── */}
          {activeTab === "messages" && (
            <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden flex h-[680px]">
              {/* Conversation list */}
              <div className="w-72 shrink-0 border-r border-border flex flex-col">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-text-muted font-semibold">Nachrichten</p>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-gold text-bg-primary text-[10px] font-bold rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {convsLoading && (
                    <div className="p-4 text-center text-xs text-text-muted">Laden...</div>
                  )}
                  {!convsLoading && conversations.length === 0 && (
                    <div className="p-6 text-center text-xs text-text-muted">
                      <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                      Noch keine Nachrichten
                    </div>
                  )}
                  {conversations.map((conv) => {
                    const lastMsg = conv.messages[conv.messages.length - 1];
                    const hasUnread = conv.messages.some(m => m.sender_id !== user?.id && !m.read_at);
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full flex items-start gap-3 p-4 text-left hover:bg-bg-elevated transition-colors ${
                          selectedConversation === conv.id ? "bg-bg-elevated border-l-2 border-l-gold" : ""
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
                            <User size={16} className="text-gold" />
                          </div>
                          {hasUnread && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gold rounded-full border-2 border-bg-secondary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold text-text-primary truncate">
                              {conv.listing_title ?? "Nachricht"}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0 ml-1">
                              {formatMsgTime(conv.updated_at)}
                            </span>
                          </div>
                          {conv.listing_type && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] bg-bg-elevated border border-border text-text-muted rounded mb-0.5">
                              {conv.listing_type}
                            </span>
                          )}
                          {lastMsg && (
                            <p className="text-[11px] text-text-muted truncate">{lastMsg.content}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right panel */}
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                  <div className="text-center">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                    Wähle eine Unterhaltung aus
                  </div>
                </div>
              ) : (() => {
                const conv = conversations.find(c => c.id === selectedConversation);
                if (!conv) return null;
                return (
                  <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border bg-bg-elevated">
                      <p className="text-sm font-semibold text-text-primary leading-tight">
                        {conv.listing_title ?? "Konversation"}
                      </p>
                      {conv.listing_type && (
                        <p className="text-xs text-text-muted mt-0.5">{conv.listing_type}</p>
                      )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                      {messagesLoading && (
                        <div className="text-center text-xs text-text-muted py-4">Nachrichten laden...</div>
                      )}
                      {!messagesLoading && activeMessages.length === 0 && (
                        <div className="text-center text-xs text-text-muted py-4">Noch keine Nachrichten</div>
                      )}
                      {activeMessages.map((msg) => {
                        const mine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              mine
                                ? "bg-gold text-bg-primary rounded-br-sm"
                                : "bg-bg-elevated border border-border text-text-secondary rounded-bl-sm"
                            }`}>
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <p className={`text-[10px] mt-1 ${mine ? "text-bg-primary/60" : "text-text-muted"}`}>
                                {formatMsgTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply input */}
                    <div className="p-3 border-t border-border flex items-end gap-2">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Nachricht schreiben..."
                        className="flex-1 bg-bg-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      />
                      <button
                        onClick={sendReply}
                        disabled={!replyText.trim() || sending}
                        className="w-9 h-9 bg-gold rounded-xl flex items-center justify-center hover:bg-gold-light transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={15} className="text-bg-primary" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── BUCHUNGEN ── */}
          {activeTab === "bookings" && (
            <div className="space-y-6">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Buchungen gesamt", value: bookingsLoading ? "…" : String(bookings.length) },
                  { label: "Bestätigt", value: bookingsLoading ? "…" : String(bookings.filter(b => b.status === "confirmed").length) },
                  { label: "Ausgaben gesamt", value: bookingsLoading ? "…" : bookings.reduce((s, b) => s + b.total, 0).toLocaleString() + " €" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-xl font-bold font-display text-text-primary">{value}</p>
                  </div>
                ))}
              </div>

              {/* Bookings list */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-text-primary">Meine Buchungen</h2>
                </div>
                {bookingsLoading && (
                  <div className="p-8 text-center text-xs text-text-muted">Laden...</div>
                )}
                {!bookingsLoading && bookings.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <Calendar size={32} className="mx-auto text-text-muted opacity-20" />
                    <p className="text-text-muted text-sm">Noch keine Buchungen</p>
                    <p className="text-xs text-text-muted">Deine Buchungen erscheinen hier sobald du etwas gebucht hast.</p>
                    <div className="flex gap-2 justify-center pt-1">
                      <Link href="/locations" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">Drehorte</Link>
                      <Link href="/vehicles" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">Fahrzeuge</Link>
                      <Link href="/props" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">Equipment</Link>
                    </div>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {bookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-lg">
                        {b.listing_type === "location" ? "📍" : b.listing_type === "vehicle" ? "🚗" : b.listing_type === "creator" ? "🎬" : b.listing_type === "job" ? "💼" : "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{b.listing_title}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(b.start_date).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                          {" – "}
                          {new Date(b.end_date).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}{b.days} Tag{b.days !== 1 ? "e" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-semibold text-text-primary">{b.total.toLocaleString()} €</p>
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border border-success/30 bg-success/10 text-success">
                          {b.status === "confirmed" ? "Bestätigt" : b.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted font-mono shrink-0 hidden sm:block">{b.ref}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applications */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">Meine Bewerbungen</h2>
                  {applications.length > 0 && (
                    <span className="text-xs text-text-muted">{applications.length} gesamt</span>
                  )}
                </div>
                {applicationsLoading && <div className="p-8 text-center text-xs text-text-muted">Laden...</div>}
                {!applicationsLoading && applications.length === 0 && (
                  <div className="text-center py-10 space-y-2">
                    <Briefcase size={28} className="mx-auto text-text-muted opacity-20" />
                    <p className="text-sm text-text-muted">Noch keine Bewerbungen</p>
                    <Link href="/jobs" className="text-xs text-gold hover:text-gold-light transition-colors">Jobs entdecken →</Link>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {applications.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                        <Briefcase size={16} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{a.job_title}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(a.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
                          {a.day_rate ? ` · ${a.day_rate}` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${
                        a.status === "accepted" ? "border-success/30 bg-success/10 text-success" :
                        a.status === "rejected" ? "border-crimson/30 bg-crimson/10 text-crimson-light" :
                        "border-gold/30 bg-gold/10 text-gold"
                      }`}>
                        {a.status === "accepted" ? "Angenommen" : a.status === "rejected" ? "Abgelehnt" : "Ausstehend"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── EINNAHMEN ── */}
          {activeTab === "earnings" && (() => {
            const confirmedBookings = bookings.filter(b => b.status === "confirmed");
            const totalSpent = confirmedBookings.reduce((s, b) => s + b.total, 0);
            const avgBooking = confirmedBookings.length > 0 ? Math.round(totalSpent / confirmedBookings.length) : 0;
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Buchungen gesamt",
                      value: bookingsLoading ? "…" : String(confirmedBookings.length),
                      sub: confirmedBookings.length === 0 ? "Noch keine Buchungen" : `${confirmedBookings.length} bestätigt`,
                      color: "text-text-primary",
                    },
                    {
                      label: "Ausgaben gesamt",
                      value: bookingsLoading ? "…" : totalSpent.toLocaleString() + " €",
                      sub: "inkl. Plattformgebühr (10%)",
                      color: confirmedBookings.length > 0 ? "text-gold" : "text-text-muted",
                    },
                    {
                      label: "Ø pro Buchung",
                      value: bookingsLoading ? "…" : avgBooking > 0 ? avgBooking.toLocaleString() + " €" : "—",
                      sub: "Durchschnittlicher Buchungswert",
                      color: "text-text-muted",
                    },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className="p-5 rounded-xl border border-border bg-bg-secondary">
                      <p className="text-xs text-text-muted uppercase tracking-widest mb-2">{label}</p>
                      <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
                      <p className="text-xs text-text-muted mt-1">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Buchungshistorie */}
                <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="font-semibold text-text-primary">Letzte Buchungen</h2>
                  </div>
                  {bookingsLoading && <div className="p-8 text-center text-xs text-text-muted">Laden...</div>}
                  {!bookingsLoading && bookings.length === 0 && (
                    <div className="p-8 text-center text-xs text-text-muted">
                      Noch keine Buchungen —{" "}
                      <Link href="/locations" className="text-gold hover:text-gold-light transition-colors">Jetzt entdecken →</Link>
                    </div>
                  )}
                  <div className="divide-y divide-border">
                    {bookings.slice(0, 10).map((b) => (
                      <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-lg">
                          {b.listing_type === "location" ? "📍" : b.listing_type === "vehicle" ? "🚗" : b.listing_type === "creator" ? "🎬" : b.listing_type === "job" ? "💼" : "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{b.listing_title}</p>
                          <p className="text-xs text-text-muted font-mono">{b.ref}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-text-primary">{b.total.toLocaleString()} €</p>
                          <p className="text-xs text-text-muted">{new Date(b.created_at).toLocaleDateString("de-DE")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-gold/20 bg-gold-subtle">
                  <h3 className="font-semibold text-gold mb-2 text-sm">Wie funktioniert der Escrow-Auszahlungsprozess?</h3>
                  <div className="space-y-2 text-xs text-text-muted">
                    {[
                      "Käufer zahlt den Gesamtbetrag bei der Buchung.",
                      "CineGenius hält das Geld treuhänderisch bis zur Bestätigung.",
                      "Nach Abschluss wird 90% an den Anbieter ausgezahlt.",
                      "Auszahlungen erfolgen innerhalb von 3–5 Werktagen auf das Konto.",
                    ].map((t, i) => (
                      <p key={i} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-gold/20 border border-gold/30 text-gold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        {t}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── AUSZAHLUNGEN ── */}
          {activeTab === "payouts" && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-1">Ausstehende Auszahlung</p>
                    <p className="font-display text-3xl font-bold text-text-muted mb-1">0 €</p>
                    <p className="text-xs text-text-muted">Noch keine abgeschlossenen Buchungen</p>
                  </div>
                  <button disabled className="px-4 py-2 bg-border text-text-muted text-sm font-semibold rounded-lg cursor-not-allowed">
                    Auszahlung anfordern
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-secondary">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold text-text-primary">Auszahlungshistorie</h2>
                </div>
                <div className="p-8 text-center space-y-2">
                  <ArrowDownCircle size={28} className="mx-auto text-text-muted opacity-20" />
                  <p className="text-sm text-text-muted">Noch keine Auszahlungen</p>
                  <p className="text-xs text-text-muted">Auszahlungen werden nach abgeschlossenen Buchungen freigegeben.</p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-4 text-sm">Auszahlungskonto hinterlegen</h3>
                <p className="text-xs text-text-muted mb-3">Bankverbindung wird für Auszahlungen benötigt. Aktivierung folgt mit dem Buchungssystem.</p>
                <button disabled className="px-3 py-2 border border-border text-xs text-text-muted rounded-lg cursor-not-allowed">
                  + Bankverbindung hinzufügen (demnächst)
                </button>
              </div>
            </div>
          )}

          {/* ── TRANSAKTIONEN ── */}
          {activeTab === "transactions" && (() => {
            const confirmed = bookings.filter(b => b.status === "confirmed");
            const totalFees = confirmed.reduce((s, b) => s + Math.round(b.total / 11), 0); // approx 10% of subtotal
            const totalPaid = confirmed.reduce((s, b) => s + b.total, 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: "Abgeschlossen", value: bookingsLoading ? "…" : String(confirmed.length), color: confirmed.length > 0 ? "text-success" : "text-text-muted" },
                    { label: "Ausstehend", value: bookingsLoading ? "…" : "0", color: "text-text-muted" },
                    { label: "Gebühren gesamt", value: bookingsLoading ? "…" : totalFees.toLocaleString() + " €", color: "text-text-muted" },
                    { label: "Bezahlt gesamt", value: bookingsLoading ? "…" : totalPaid.toLocaleString() + " €", color: totalPaid > 0 ? "text-gold" : "text-text-muted" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-lg border border-border bg-bg-secondary text-center">
                      <p className={`text-xl font-bold font-display ${color}`}>{value}</p>
                      <p className="text-xs text-text-muted">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <span className="text-sm font-semibold text-text-primary">Transaktionshistorie</span>
                    <Link href="/invoices" className="text-xs text-gold hover:underline flex items-center gap-1">
                      Alle Rechnungen <ChevronRight size={12} />
                    </Link>
                  </div>
                  {bookingsLoading && <div className="p-8 text-center text-xs text-text-muted">Laden...</div>}
                  {!bookingsLoading && bookings.length === 0 && (
                    <div className="p-8 text-center space-y-2">
                      <Receipt size={28} className="mx-auto text-text-muted opacity-20" />
                      <p className="text-sm text-text-muted">Noch keine Transaktionen</p>
                      <p className="text-xs text-text-muted">Transaktionen erscheinen hier sobald Buchungen bestätigt wurden.</p>
                    </div>
                  )}
                  <div className="divide-y divide-border">
                    {bookings.map((b) => (
                      <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                          <Receipt size={14} className="text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{b.listing_title}</p>
                          <p className="text-xs text-text-muted font-mono">{b.ref} · {new Date(b.created_at).toLocaleDateString("de-DE")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-success">−{b.total.toLocaleString()} €</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-success/30 bg-success/10 text-success font-semibold">
                            {b.status === "confirmed" ? "Bestätigt" : b.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── ANALYSEN ── */}
          {activeTab === "analytics" && (() => {
            // Compute top listings by inquiry count from real conversations
            const inquiryMap = conversations.reduce<Record<string, { title: string; type: string; count: number }>>((acc, c) => {
              if (!c.listing_id) return acc;
              if (!acc[c.listing_id]) acc[c.listing_id] = { title: c.listing_title ?? "Unbekannt", type: c.listing_type ?? "", count: 0 };
              acc[c.listing_id].count++;
              return acc;
            }, {});
            const topByInquiries = Object.entries(inquiryMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
            // Fall back to real listings if no conversations yet
            const topListings = topByInquiries.length > 0
              ? topByInquiries.map(([id, d]) => ({ id, title: d.title, type: d.type, count: d.count }))
              : myListings.slice(0, 5).map((l) => ({ id: l.id, title: l.title, type: l.type, count: 0 }));
            const maxCount = Math.max(...topListings.map(l => l.count), 1);

            const listingsWithInquiries = new Set(conversations.map(c => c.listing_id).filter(Boolean)).size;

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Anfragen gesamt",
                      value: listingsLoading || convsLoading ? "…" : String(conversations.length),
                      sub: unreadCount > 0 ? `${unreadCount} ungelesen` : "Alle gelesen",
                    },
                    {
                      label: "Aktive Inserate",
                      value: listingsLoading ? "…" : String(myListings.filter(l => l.published).length),
                      sub: `${myListings.length} gesamt`,
                    },
                    {
                      label: "Inserate mit Anfragen",
                      value: convsLoading ? "…" : String(listingsWithInquiries),
                      sub: myListings.length > 0 ? `von ${myListings.length} Inseraten` : "Noch keine Inserate",
                    },
                    {
                      label: "Ungelesen",
                      value: String(unreadCount),
                      sub: unreadCount > 0 ? "Neue Nachrichten" : "Alles erledigt",
                    },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="p-5 rounded-xl border border-border bg-bg-secondary">
                      <p className="text-xs text-text-muted uppercase tracking-widest mb-2">{label}</p>
                      <p className="text-2xl font-bold font-display text-gold">{value}</p>
                      <p className="text-xs text-text-muted mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <BarChart2 size={16} className="text-gold" /> Anfragen der letzten 7 Tage
                  </h3>
                  {conversations.length === 0 ? (
                    <div className="flex items-end gap-2 h-28 opacity-30">
                      {[0, 0, 0, 0, 0, 0, 0].map((_, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t bg-gold/30" style={{ height: "4px" }} />
                          <span className="text-[10px] text-text-muted">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}</span>
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    // Count conversations per day over last 7 days
                    const days: number[] = Array(7).fill(0);
                    const now = new Date();
                    conversations.forEach((c) => {
                      const d = new Date(c.created_at);
                      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
                      if (diff >= 0 && diff < 7) days[6 - diff]++;
                    });
                    const maxDay = Math.max(...days, 1);
                    return (
                      <div className="flex items-end gap-2 h-28">
                        {days.map((v, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t bg-gold/40 hover:bg-gold/70 transition-colors"
                              style={{ height: `${Math.max((v / maxDay) * 100, v > 0 ? 8 : 2)}%` }}
                            />
                            <span className="text-[10px] text-text-muted">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                  <h3 className="font-semibold text-text-primary mb-4">
                    {topByInquiries.length > 0 ? "Top-Inserate nach Anfragen" : "Meine Inserate"}
                  </h3>
                  {topListings.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4">
                      Noch keine Inserate.{" "}
                      <Link href="/inserat" className="text-gold hover:text-gold-light transition-colors">Jetzt erstellen →</Link>
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topListings.map((l, i) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <span className="text-xs text-text-muted w-4 shrink-0">{i + 1}</span>
                          <div className="w-8 h-8 rounded bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-base">
                            {l.type === "location" ? "📍" : l.type === "vehicle" ? "🚗" : l.type === "job" ? "💼" : l.type === "creator" ? "🎬" : "📦"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">{l.title}</p>
                            <div className="w-full bg-bg-elevated rounded-full h-1.5 mt-1">
                              <div
                                className="bg-gold h-1.5 rounded-full transition-all"
                                style={{ width: `${(l.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-mono text-text-secondary shrink-0">
                            {l.count} {l.count === 1 ? "Anfrage" : "Anfragen"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── EINSTELLUNGEN ── */}
          {activeTab === "settings" && (
            <div className="max-w-xl space-y-5">

              {/* Öffentliches Profil */}
              {(() => {
                const avatarSrc = profileAvatarUrl || user?.imageUrl || "";
                const displayName = profileDisplayName || (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "") || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "—";
                return (
              <div className="flex items-start gap-5 p-6 rounded-2xl border-2 border-gold/30 bg-gold-subtle">
                <div className="shrink-0">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gold/30" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gold/20 border-2 border-gold/30 flex items-center justify-center">
                      <span className="text-gold font-bold text-lg">{displayName[0]?.toUpperCase() ?? "?"}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base font-bold text-text-primary leading-tight">{displayName}</p>
                  <p className="text-xs text-text-muted mt-0.5 mb-4">{profileRole || "CineGenius Mitglied"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors"
                    >
                      <Pencil size={12} /> Profil bearbeiten
                    </Link>
                    <Link
                      href={user?.id ? `/creators/${user.id}` : "/creators"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors"
                    >
                      <ExternalLink size={12} /> Öffentlich ansehen
                    </Link>
                  </div>
                </div>
              </div>
                );
              })()}

              {/* Konto-Info (read-only) */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-4">Konto</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold block mb-1">E-Mail</label>
                    <p className="text-sm text-text-secondary">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Wird über Clerk verwaltet</p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Mitglied seit</label>
                    <p className="text-sm text-text-secondary">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Privatsphäre */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-1">Privatsphäre</h3>
                <p className="text-xs text-text-muted mb-4">Bestimme, wer dein Profil sehen und dir schreiben darf.</p>
                <div className="space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {privacySettings.profile_visibility === "private"
                          ? <Lock size={16} className="text-gold" />
                          : <Globe size={16} className="text-text-muted" />}
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary font-medium">Profil privat</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {privacySettings.profile_visibility === "private"
                            ? "Nur Freunde können dein Profil sehen"
                            : "Jeder kann dein Profil sehen"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePrivacy("profile_visibility", privacySettings.profile_visibility === "private" ? "public" : "private")}
                      disabled={privacyLoading}
                      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${privacySettings.profile_visibility === "private" ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${privacySettings.profile_visibility === "private" ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </label>
                  <div className="border-t border-border" />
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {privacySettings.message_permission === "friends_only"
                          ? <Lock size={16} className="text-gold" />
                          : <Globe size={16} className="text-text-muted" />}
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary font-medium">Nur Freunde dürfen schreiben</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {privacySettings.message_permission === "friends_only"
                            ? "Nur Freunde können dir Nachrichten senden"
                            : "Jeder kann dir Nachrichten senden"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePrivacy("message_permission", privacySettings.message_permission === "friends_only" ? "everyone" : "friends_only")}
                      disabled={privacyLoading}
                      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${privacySettings.message_permission === "friends_only" ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${privacySettings.message_permission === "friends_only" ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </label>
                </div>
              </div>

              {/* Benachrichtigungen */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-4">Benachrichtigungen</h3>
                <div className="space-y-3">
                  {[
                    { label: "Neue Buchungsanfragen", desc: "Wenn jemand dein Inserat bucht" },
                    { label: "Neue Nachrichten", desc: "Eingehende Anfragen und Antworten" },
                    { label: "Bewertung erhalten", desc: "Nach einer abgeschlossenen Buchung" },
                    { label: "Plattform-Updates", desc: "Neuigkeiten und neue Features" },
                  ].map(({ label, desc }) => (
                    <label key={label} className="flex items-center justify-between cursor-pointer gap-4 py-1">
                      <div>
                        <p className="text-sm text-text-secondary">{label}</p>
                        <p className="text-[11px] text-text-muted">{desc}</p>
                      </div>
                      <input type="checkbox" className="accent-gold shrink-0" defaultChecked />
                    </label>
                  ))}
                </div>
              </div>

            </div>
          )}
          {/* ── FREUNDE ── */}
          {activeTab === "friends" && (
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
                    <Users size={18} className="text-gold" /> Freunde
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">Verwalte deine Verbindungen auf CineGenius</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 p-1 bg-bg-secondary border border-border rounded-xl w-fit">
                {(["incoming", "friends", "outgoing"] as const).map((t) => {
                  const labels = { incoming: "Anfragen", friends: "Freunde", outgoing: "Gesendet" };
                  const counts = { incoming: friendsIncoming.length, friends: friends.length, outgoing: friendsOutgoing.length };
                  return (
                    <button
                      key={t}
                      onClick={() => setFriendsTab(t)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                        friendsTab === t ? "bg-gold text-bg-primary" : "text-text-secondary hover:text-gold"
                      }`}
                    >
                      {labels[t]}
                      {counts[t] > 0 && (
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${friendsTab === t ? "bg-bg-primary/20" : "bg-gold/10 text-gold"}`}>
                          {counts[t]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {friendsLoading && (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-bg-secondary border border-border rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!friendsLoading && friendsTab === "incoming" && (
                <>
                  {friendsIncoming.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                      <UserPlus size={24} className="mx-auto text-text-muted opacity-30 mb-3" />
                      <p className="text-sm text-text-muted">Keine offenen Anfragen</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendsIncoming.map(f => (
                        <div key={f.friendship_id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary">
                          <div className="shrink-0">
                            {f.avatar_url ? (
                              <img src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                                <span className="text-gold font-bold text-base">{f.display_name[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary text-sm truncate">{f.display_name}</p>
                            <p className="text-xs text-text-muted truncate">{f.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => acceptFriend(f.friendship_id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors">
                              <Check size={12} /> Annehmen
                            </button>
                            <button onClick={() => rejectFriend(f.friendship_id)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-border text-text-muted text-xs rounded-lg hover:border-red-400 hover:text-red-400 transition-colors">
                              <X size={12} /> Ablehnen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!friendsLoading && friendsTab === "friends" && (
                <>
                  {friends.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                      <Users size={24} className="mx-auto text-text-muted opacity-30 mb-3" />
                      <p className="text-sm text-text-muted">Noch keine Freunde</p>
                      <p className="text-xs text-text-muted mt-1">Besuche Profile von Filmschaffenden und füge sie hinzu.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friends.map(f => (
                        <div key={f.friendship_id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-colors">
                          <div className="shrink-0">
                            {f.avatar_url ? (
                              <img src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                                <span className="text-gold font-bold text-base">{f.display_name[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary text-sm truncate">{f.display_name}</p>
                            <p className="text-xs text-text-muted truncate">{f.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Link href={`/creators/${f.user_id}`} className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all">
                              Profil
                            </Link>
                            <button onClick={() => removeFriendEntry(f.friendship_id)}
                              className="px-3 py-1.5 text-xs border border-border text-text-muted rounded-lg hover:border-red-400 hover:text-red-400 transition-all">
                              Entfernen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!friendsLoading && friendsTab === "outgoing" && (
                <>
                  {friendsOutgoing.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                      <UserPlus size={24} className="mx-auto text-text-muted opacity-30 mb-3" />
                      <p className="text-sm text-text-muted">Keine gesendeten Anfragen</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendsOutgoing.map(f => (
                        <div key={f.friendship_id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary">
                          <div className="shrink-0">
                            {f.avatar_url ? (
                              <img src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                                <span className="text-gold font-bold text-base">{f.display_name[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary text-sm truncate">{f.display_name}</p>
                            <p className="text-xs text-text-muted truncate">{f.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-muted flex items-center gap-1 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg">
                              <Clock size={11} /> Ausstehend
                            </span>
                            <button onClick={() => removeFriendEntry(f.friendship_id)}
                              className="px-3 py-1.5 text-xs border border-border text-text-muted rounded-lg hover:border-red-400 hover:text-red-400 transition-all">
                              Zurückziehen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── MERKLISTE ── */}
          {activeTab === "favorites" && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
                    <Heart size={18} className="text-crimson-light fill-current" /> Merkliste
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">Deine gespeicherten Inserate</p>
                </div>
                {!favoritesLoading && favorites.length > 0 && (
                  <span className="px-3 py-1 bg-bg-secondary border border-border text-text-muted text-xs rounded-full">
                    {favorites.length} {favorites.length === 1 ? "Eintrag" : "Einträge"}
                  </span>
                )}
              </div>

              {favoritesLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-bg-secondary border border-border rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!favoritesLoading && favorites.length === 0 && (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl space-y-4">
                  <div className="w-14 h-14 mx-auto bg-bg-secondary border border-border rounded-full flex items-center justify-center">
                    <Heart size={22} className="text-text-muted opacity-30" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-1">Noch nichts gespeichert</h3>
                    <p className="text-sm text-text-muted max-w-xs mx-auto">
                      Klicke das Herz-Symbol auf einer Detailseite, um Inserate zu speichern.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <Link href="/locations" className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all">Drehorte</Link>
                    <Link href="/creators" className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all">Filmschaffende</Link>
                    <Link href="/jobs" className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all">Jobs</Link>
                  </div>
                </div>
              )}

              {!favoritesLoading && favorites.length > 0 && (
                <div className="space-y-3">
                  {favorites.map(fav => {
                    const config = favTypeConfig[fav.listing_type];
                    if (!config) return null;
                    const Icon = config.icon;
                    const isRemoving = removingFav === fav.listing_id;
                    return (
                      <div key={fav.id} className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all ${isRemoving ? "opacity-50" : ""}`}>
                        <Link href={config.href(fav.listing_id)} className="shrink-0">
                          {fav.listing_image ? (
                            <img src={fav.listing_image} alt={fav.listing_title ?? ""} className="w-14 h-14 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                              <Icon size={20} className={config.color} />
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={config.href(fav.listing_id)} className="hover:text-gold transition-colors">
                            <p className="font-semibold text-text-primary truncate">{fav.listing_title ?? "Inserat"}</p>
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`flex items-center gap-1 text-xs ${config.color}`}>
                              <Icon size={10} /> {config.label}
                            </span>
                            {fav.listing_city && <span className="text-xs text-text-muted">{fav.listing_city}</span>}
                          </div>
                        </div>
                        {fav.listing_price != null && fav.listing_price > 0 && (
                          <div className="text-right shrink-0 hidden sm:block">
                            <p className="text-sm font-semibold text-gold font-mono">{fav.listing_price.toLocaleString()} €</p>
                            <p className="text-xs text-text-muted">/ Tag</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={config.href(fav.listing_id)} className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all">
                            Ansehen
                          </Link>
                          <button onClick={() => removeFavorite(fav)} disabled={isRemoving}
                            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors disabled:opacity-40" title="Entfernen">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
    </ProfileGuard>
  );
}
