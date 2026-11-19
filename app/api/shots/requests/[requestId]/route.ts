import { shotsRequestRoute } from "@/lib/shots-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{requestId:string}>};
export async function GET(request:Request,context:Context){return shotsRequestRoute(request,(await context.params).requestId)}
