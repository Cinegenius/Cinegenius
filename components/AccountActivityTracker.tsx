'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ACTIVITY_UPDATED_EVENT, requestAccountActivity, trackAccountActivity } from '@/lib/account-activity-client';

export default function AccountActivityTracker() {
  const { isLoaded, userId, sessionId } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoaded || !userId || !sessionId) return;
    return trackAccountActivity({
      page: document, events: window, online: () => navigator.onLine !== false,
      now: () => performance.now(), request: requestAccountActivity,
      confirmed: status => {
        window.dispatchEvent(new Event(ACTIVITY_UPDATED_EVENT));
        if (status.reactivated) {
          window.dispatchEvent(new Event('cg:account-reactivated'));
          router.refresh();
        }
      },
    });
  }, [isLoaded, userId, sessionId, router]);
  return null;
}
