import { type NextRequest } from 'next/server';
import { POST as sendFirstMessage } from '@/app/api/conversations/route';
import { nativeMessageSend } from '@/lib/native-message-send';

export async function POST(request: NextRequest) {
  return nativeMessageSend(request, sendFirstMessage);
}
