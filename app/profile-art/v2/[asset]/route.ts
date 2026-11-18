import { readServerProfileArt } from "@/lib/profile-art-refill-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Source-only contract: the independent reader switch remains false.
export const GET = readServerProfileArt;
export const HEAD = readServerProfileArt;
