"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Send, ArrowLeft, MessageSquare, Loader2, User } from "lucide-react";
import { Suspense } from "react";

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

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const { data } = await res.json();
    if (!data) return;

    // Enrich with other user's profile
    const enriched = await Promise.all(
      (data as Conversation[]).map(async (conv) => {
        const otherId = conv.sender_id === user?.id ? conv.receiver_id : conv.sender_id;
        const profileRes = await fetch(`/api/profile/by-id?id=${otherId}`).catch(() => null);
        if (profileRes?.ok) {
          const { profile } = await profileRes.json();
          return { ...conv, otherName: profile?.display_name ?? "Unbekannt", otherAvatar: profile?.avatar_url };
        }
        return { ...conv, otherName: "Unbekannt" };
      })
    );
    setConversations(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user, loadConversations]);

  // Load recipient name if ?to= param
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

  // Open conversation when ?to= param and conversations loaded
  useEffect(() => {
    if (!toParam || loading) return;
    const existing = conversations.find(c =>
      (c.sender_id === toParam || c.receiver_id === toParam)
    );
    if (existing) {
      setActiveId(existing.id);
      setNewConvRecipient(null);
      loadMessages(existing.id);
    }
    // else: stays in new conversation mode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toParam, loading, conversations]);

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/conversations/${convId}`);
    const { messages: msgs } = await res.json();
    setMessages(msgs ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function openConversation(conv: Conversation) {
    setActiveId(conv.id);
    setNewConvRecipient(null);
    loadMessages(conv.id);
  }

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);

    try {
      if (newConvRecipient) {
        // Start new conversation
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

  return (
    <div className="min-h-screen bg-bg-primary pt-16 flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto w-full flex h-[calc(100vh-4rem)]">

        {/* Sidebar */}
        <div className={`w-full sm:w-80 shrink-0 border-r border-border flex flex-col ${activeId || isNewConv ? "hidden sm:flex" : "flex"}`}>
          <div className="p-4 border-b border-border">
            <h1 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
              <MessageSquare size={18} className="text-gold" /> Nachrichten
            </h1>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : conversations.length === 0 && !isNewConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare size={32} className="text-text-muted mb-3 opacity-40" />
              <p className="text-sm text-text-muted">Noch keine Nachrichten</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* New conversation entry at top */}
              {isNewConv && (
                <button
                  onClick={() => {}}
                  className="w-full flex items-center gap-3 p-4 bg-gold/5 border-b border-gold/20 text-left"
                >
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
              {conversations.map(conv => {
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
              })}
            </div>
          )}
        </div>

        {/* Chat area */}
        {(activeId || isNewConv) ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <button
                onClick={() => { setActiveId(null); setNewConvRecipient(null); }}
                className="sm:hidden p-1 text-text-muted hover:text-text-primary"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center overflow-hidden">
                {activeConv?.otherAvatar
                  ? <img src={activeConv.otherAvatar} alt="" className="w-full h-full object-cover" />
                  : <User size={14} className="text-text-muted" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {isNewConv ? (loadingRecipient ? "Lädt..." : recipientName) : (activeConv?.otherName ?? "Gespräch")}
                </p>
                {activeConv?.listing_title && (
                  <p className="text-xs text-text-muted">{activeConv.listing_title}</p>
                )}
              </div>
              {(activeConv || isNewConv) && (
                <Link
                  href={`/profile/${isNewConv ? newConvRecipient : (activeConv?.sender_id === user?.id ? activeConv?.receiver_id : activeConv?.sender_id)}`}
                  className="ml-auto text-xs text-gold hover:text-gold-light transition-colors"
                >
                  Profil ansehen
                </Link>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isNewConv && messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare size={28} className="text-text-muted mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-text-muted">Schreib deine erste Nachricht</p>
                </div>
              )}
              {messages.map(msg => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
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
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Nachricht schreiben…"
                  className="flex-1 bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="p-2.5 bg-gold text-bg-primary rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 hidden sm:flex items-center justify-center text-center p-8">
            <div>
              <MessageSquare size={40} className="text-text-muted mx-auto mb-3 opacity-20" />
              <p className="text-text-muted text-sm">Wähle ein Gespräch aus</p>
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
