import { shotsDetailRoute, shotsDeleteRoute } from "@/lib/shots-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){return shotsDetailRoute(request,(await context.params).id)}
export async function DELETE(request:Request,context:Context){return shotsDeleteRoute(request,(await context.params).id)}
