import { type NextRequest } from 'next/server';
import { POST as sendMessage } from '@/app/api/conversations/[id]/route';
import { nativeMessageSend } from '@/lib/native-message-send';

export async function POST(request: NextRequest, context: {params: Promise<{id: string}>}) {
  return nativeMessageSend(request, req => sendMessage(req, context));
}
