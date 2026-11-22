"use client";

import { Suspense } from "react";
import InboxLoading from "@/components/InboxLoading";
import MessagesContent from "@/components/messaging/MessagesContent";

export default function MessagesPage() {
  return <Suspense fallback={<InboxLoading active="chats" />}><MessagesContent/></Suspense>;
}
