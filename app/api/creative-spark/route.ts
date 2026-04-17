export const runtime = "nodejs";

import Groq from "groq-sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "KI noch nicht eingerichtet." }),
      { status: 503 }
    );
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: "Bitte gib mindestens ein paar Stichpunkte ein." }),
      { status: 400 }
    );
  }
  if (prompt.length > 400) {
    return new Response(
      JSON.stringify({ error: "Zu lang (max. 400 Zeichen)" }),
      { status: 400 }
    );
  }

  const stream = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_tokens: 180,
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "Du bist ein kreativer Filmstorywriter. Schreib aus den gegebenen Stichpunkten einen kurzen, packenden Projekt-Pitch auf Deutsch (2–3 Sätze, max. 80 Wörter). Keine Überschrift, keine Einleitung — direkt mit dem Pitch beginnen. Filmisch, atmosphärisch, inspirierend.",
      },
      { role: "user", content: prompt.trim() },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(new TextEncoder().encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
