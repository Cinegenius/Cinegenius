'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

/** Only foreground entry or real interaction counts. No repeating/background ping. */
export default function AccountActivityTracker() {
  const router = useRouter();
  const { userId, sessionId, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded || !userId || !sessionId) return;
    const controller = new AbortController();
    let lastSuccess = 0;
    let retryAfter = 0;
    let pending = false;
    const record = async () => {
      if (document.visibilityState !== 'visible' || pending || Date.now() < retryAfter || Date.now() - lastSuccess < 60 * 60 * 1000) return;
      pending = true;
      try {
        const response = await fetch('/api/account/activity', { method: 'POST', cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          lastSuccess = Date.now();
          if (result.reactivated) { window.dispatchEvent(new Event('cg:account-reactivated')); router.refresh(); }
        } else retryAfter = Date.now() + 60_000;
      } catch { retryAfter = Date.now() + 60_000; }
      finally { pending = false; }
    };
    const interaction = (event: Event) => { if (event.isTrusted) void record(); };
    const foreground = () => { void record(); };
    void record();
    document.addEventListener('visibilitychange', foreground);
    window.addEventListener('pageshow', foreground);
    window.addEventListener('online', foreground);
    document.addEventListener('pointerdown', interaction, { passive: true });
    document.addEventListener('keydown', interaction);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', foreground);
      window.removeEventListener('pageshow', foreground);
      window.removeEventListener('online', foreground);
      document.removeEventListener('pointerdown', interaction);
      document.removeEventListener('keydown', interaction);
    };
  }, [isLoaded, userId, sessionId, router]);
  return null;
}
