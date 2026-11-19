import { shotsMediaRoute } from "@/lib/shots-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string;variant:string}>};
export async function GET(request:Request,context:Context){const {id,variant}=await context.params;return shotsMediaRoute(request,id,variant)}
