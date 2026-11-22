import {nativeGenieRoute} from "@/lib/native-genie-server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=600;

export async function POST(request:Request,{params}:{params:Promise<{kind:string}>}){
 return nativeGenieRoute(request,(await params).kind);
}
