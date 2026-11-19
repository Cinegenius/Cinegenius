import { shotsFeedRoute, shotsPublishRoute } from "@/lib/shots-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=35;
export const GET=shotsFeedRoute;
export const POST=shotsPublishRoute;
