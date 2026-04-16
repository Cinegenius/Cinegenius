"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Send, ArrowLeft, MessageSquare, Loader2, User, UserPlus, Check, X } from "lucide-react";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

type Conversation = {
  id: string;
  sender_id: string;
  receiver_id: string;
  listing_title: string | null;
  updated_at: string;
  messages: Message[];
  otherName?: string;
  otherAvatar?: string;
};

type FriendRequest = {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function MessagesContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const toParam = searchParams.get("to");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newConvRecipient, setNewConvRecipient] = useState<string | null>(toParam);
  const [recipientName, setRecipientName] = useState("");
  const [loadingRecipient, setLoadingRecipient] = useState(!!toParam);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Friend requests
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Mobile: true = zeige Chat, false = zeige Liste
  const showChat = !!(activeId || newConvRecipient);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const { data } = await res.json();
    if (!data) return;
    // Profiles are now pre-enriched server-side — no per-conversation fetches needed
    setConversations(data as Conversation[]);
    setLoading(false);
  }, []);

  const loadFriendRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/friendships");
      if (!res.ok) return;
      const { incoming } = await res.json();
      if (Array.isArray(incoming)) setFriendRequests(incoming);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadFriendRequests();
  }, [user, loadConversations, loadFriendRequests]);

  useEffect(() => {
    if (!toParam) return;
    fetch(`/api/profile/by-id?id=${toParam}`)
      .then(r => r.json())
      .then(({ profile }) => {
        setRecipientName(profile?.display_name ?? "Unbekannt");
        setLoadingRecipient(false);
      })
      .catch(() => setLoadingRecipient(false));
  }, [toParam]);

  useEffect(() => {
    if (!toParam || loading) return;
    const existing = conversations.find(c =>
      c.sender_id === toParam || c.receiver_id === toParam
    );
    if (existing) {
      setActiveId(existing.id);
      setNewConvRecipient(null);
      loadMessages(existing.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toParam, loading, conversations]);

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/conversations/${convId}`);
    const { messages: msgs } = await res.json();
    setMessages(msgs ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // Realtime: neue Nachrichten sofort empfangen wenn Gespräch offen
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`messages:${activeId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          // Eigene gesendete Nachrichten werden schon optimistisch hinzugefügt — nicht doppeln
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  function openConversation(conv: Conversation) {
    setActiveId(conv.id);
    setNewConvRecipient(null);
    loadMessages(conv.id);
  }

  function closeChat() {
    setActiveId(null);
    setNewConvRecipient(null);
    setMessages([]);
  }

  async function handleFriendRequest(friendshipId: string, action: "accepted" | "rejected") {
    setProcessingIds(prev => new Set(prev).add(friendshipId));
    try {
      await fetch(`/api/friendships/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));
    } catch { /* ignore */ } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(friendshipId); return s; });
    }
  }

  function dismissRequest(friendshipId: string) {
    setDismissedIds(prev => new Set(prev).add(friendshipId));
  }

  const visibleRequests = friendRequests.filter(r => !dismissedIds.has(r.friendship_id));

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);

    try {
      if (newConvRecipient) {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: newConvRecipient, content: text.trim() }),
        });
        const { conversationId, error } = await res.json();
        if (error) throw new Error(error);
        setText("");
        setNewConvRecipient(null);
        await loadConversations();
        setActiveId(conversationId);
        await loadMessages(conversationId);
      } else if (activeId) {
        const res = await fetch(`/api/conversations/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text.trim() }),
        });
        const { message, error } = await res.json();
        if (error) throw new Error(error);
        setText("");
        setMessages(prev => [...prev, message]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find(c => c.id === activeId);
  const isNewConv = !!newConvRecipient && !activeId;
  const otherUserId = isNewConv
    ? newConvRecipient
    : activeConv
      ? (activeConv.sender_id === user?.id ? activeConv.receiver_id : activeConv.sender_id)
      : null;

  return (
    <div className="fixed inset-0 top-16 bottom-14 lg:bottom-0 bg-bg-primary flex flex-col overflow-hidden">

      {/* ── KONVERSATIONSLISTE (Mobile: volle Breite, Desktop: linke Spalte) ── */}
      <div className={`
        absolute inset-0
        sm:relative sm:w-80 sm:shrink-0 sm:border-r sm:border-border
        flex flex-col bg-bg-primary
        transition-transform duration-300 ease-out
        ${showChat ? "-translate-x-full sm:translate-x-0" : "translate-x-0"}
      `}>
        <div className="px-4 py-4 border-b border-border shrink-0">
          <h1 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
            <MessageSquare size={18} className="text-gold" /> Nachrichten
          </h1>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* ── Freundschaftsanfragen ── */}
            {visibleRequests.length > 0 && (
              <div className="border-b border-border">
                <div className="px-4 py-2 bg-bg-elevated">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus size={12} /> Anfragen · {visibleRequests.length}
                  </p>
                </div>
                {visibleRequests.map(req => {
                  const isProcessing = processingIds.has(req.friendship_id);
                  return (
                    <div key={req.friendship_id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
                      <Link href={`/profile/${req.user_id}`} className="shrink-0">
                        <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center overflow-hidden">
                          {req.avatar_url
                            ? <img src={req.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <User size={16} className="text-text-muted" />}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${req.user_id}`}>
                          <p className="text-sm font-semibold text-text-primary truncate hover:text-gold transition-colors">
                            {req.display_name}
                          </p>
                        </Link>
                        <p className="text-xs text-text-muted">möchte sich vernetzen</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {isProcessing ? (
                          <Loader2 size={16} className="animate-spin text-text-muted" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleFriendRequest(req.friendship_id, "accepted")}
                              title="Annehmen"
                              className="w-8 h-8 rounded-full bg-gold/10 text-gold border border-gold/20 flex items-center justify-center hover:bg-gold hover:text-bg-primary transition-colors"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleFriendRequest(req.friendship_id, "rejected")}
                              title="Ablehnen"
                              className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={() => dismissRequest(req.friendship_id)}
                              title="Ausblenden"
                              className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors text-[10px] font-bold"
                            >
                              –
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Neue Konversation Placeholder ── */}
            {isNewConv && (
              <button className="w-full flex items-center gap-3 p-4 bg-gold/5 border-b border-gold/20 text-left">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <User size={16} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {loadingRecipient ? "Lädt..." : recipientName}
                  </p>
                  <p className="text-xs text-gold">Neue Nachricht</p>
                </div>
              </button>
            )}

            {/* ── Konversationsliste ── */}
            {conversations.length === 0 && !isNewConv && visibleRequests.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[200px] gap-4">
                <div className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                  <MessageSquare size={20} className="text-text-muted opacity-50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-1">Keine Nachrichten</p>
                  <p className="text-xs text-text-muted leading-relaxed">Schreibe Filmschaffenden oder Inserenten direkt an.</p>
                </div>
                <Link href="/creators" className="text-xs text-gold hover:text-gold-light transition-colors font-medium">
                  Crew entdecken →
                </Link>
              </div>
            ) : (
              conversations.map(conv => {
                const lastMsg = conv.messages?.[conv.messages.length - 1];
                const unread = conv.messages?.filter(m => m.sender_id !== user?.id && !m.read_at).length ?? 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 p-4 border-b border-border text-left hover:bg-bg-elevated transition-colors ${activeId === conv.id ? "bg-bg-elevated" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {conv.otherAvatar
                        ? <img src={conv.otherAvatar} alt="" className="w-full h-full object-cover" />
                        : <User size={16} className="text-text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-primary truncate">{conv.otherName}</p>
                        {lastMsg && <span className="text-[10px] text-text-muted shrink-0 ml-1">{formatTime(lastMsg.created_at)}</span>}
                      </div>
                      <p className="text-xs text-text-muted truncate">{lastMsg?.content ?? "Keine Nachrichten"}</p>
                    </div>
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-gold text-bg-primary text-[10px] font-bold flex items-center justify-center shrink-0">{unread}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── CHAT-BEREICH (Mobile: volle Breite, Desktop: rechte Spalte) ── */}
      <div className={`
        absolute inset-0 sm:static sm:flex-1
        flex flex-col bg-bg-primary
        transition-transform duration-300 ease-out
        ${showChat ? "translate-x-0" : "translate-x-full sm:translate-x-0"}
      `}>
        {showChat ? (
          <>
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 shrink-0">
              <button
                onClick={closeChat}
                className="p-1.5 -ml-1 text-text-muted hover:text-text-primary active:scale-95 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-9 h-9 rounded-full bg-bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0">
                {activeConv?.otherAvatar
                  ? <img src={activeConv.otherAvatar} alt="" className="w-full h-full object-cover" />
                  : <User size={15} className="text-text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {isNewConv ? (loadingRecipient ? "Lädt..." : recipientName) : (activeConv?.otherName ?? "Gespräch")}
                </p>
                {activeConv?.listing_title && (
                  <p className="text-xs text-text-muted truncate">{activeConv.listing_title}</p>
                )}
              </div>
              {otherUserId && (
                <Link
                  href={`/profile/${otherUserId}`}
                  className="shrink-0 text-xs text-gold hover:text-gold-light transition-colors"
                >
                  Profil
                </Link>
              )}
            </div>

            {/* Nachrichten */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {isNewConv && messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={22} className="text-text-muted opacity-50" />
                  </div>
                  <p className="text-sm font-medium text-text-secondary mb-1">Neue Unterhaltung</p>
                  <p className="text-xs text-text-muted">
                    Schreib deine erste Nachricht an {loadingRecipient ? "…" : recipientName}.
                  </p>
                </div>
              )}
              {(() => {
                let lastDateLabel = "";
                return messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const msgDate = new Date(msg.created_at);
                  const dateLabel = msgDate.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
                  const showDateSep = dateLabel !== lastDateLabel;
                  if (showDateSep) lastDateLabel = dateLabel;

                  // Is this the last own message and next is not own (= seen indicator)
                  const isLastOwn = isOwn && (idx === messages.length - 1 || messages[idx + 1]?.sender_id !== user?.id);
                  const isSeen = isOwn && !!msg.read_at;

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-text-muted font-medium px-2 shrink-0">{dateLabel}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className={`flex mb-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isOwn
                            ? "bg-gold text-bg-primary rounded-br-sm"
                            : "bg-bg-elevated border border-border text-text-primary rounded-bl-sm"
                        }`}>
                          {msg.content}
                          <p className={`text-[10px] mt-1 ${isOwn ? "text-bg-primary/60" : "text-text-muted"}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                      {isLastOwn && (
                        <div className="flex justify-end pr-1 pb-1">
                          <span className={`text-[10px] flex items-center gap-1 ${isSeen ? "text-gold" : "text-text-muted/60"}`}>
                            {isSeen ? (
                              <><Check size={10} className="inline" /><Check size={10} className="-ml-1.5 inline" /> Gesehen</>
                            ) : (
                              <><Check size={10} className="inline" /> Gesendet</>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              <div ref={bottomRef} />
            </div>

            {/* Eingabe */}
            <div className="px-4 py-3 border-t border-border shrink-0 safe-area-pb">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Nachricht schreiben…"
                  className="flex-1 bg-bg-elevated border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-gold transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="w-11 h-11 bg-gold text-bg-primary rounded-2xl flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-40 shrink-0"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Desktop: leerer Zustand wenn kein Gespräch offen */
          <div className="flex-1 hidden sm:flex flex-col items-center justify-center text-center p-8">
            <div className="max-w-sm">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                  <MessageSquare size={32} className="text-text-muted opacity-30" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <span className="text-[10px] text-gold font-bold">+</span>
                </div>
              </div>
              <h3 className="font-display text-lg font-bold text-text-secondary mb-2">Wähle ein Gespräch</h3>
              <p className="text-sm text-text-muted leading-relaxed mb-5">
                Wähle links eine Konversation aus, oder starte direkt von einem Profil oder Inserat.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/creators" className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all">
                  Crew entdecken
                </Link>
                <Link href="/locations" className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all">
                  Drehorte
                </Link>
                <Link href="/jobs" className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all">
                  Jobs
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}
