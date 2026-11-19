import {nativePushRoute} from '@/lib/native-push-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{installationId:string}>};
export async function GET(request:Request,{params}:Context){return nativePushRoute(request,'view',(await params).installationId)}
export async function PUT(request:Request,{params}:Context){return nativePushRoute(request,'register',(await params).installationId)}
export async function DELETE(request:Request,{params}:Context){return nativePushRoute(request,'revoke',(await params).installationId)}
export function HEAD(){return new Response(null,{status:405,headers:{Allow:'GET, PUT, DELETE','Cache-Control':'private, no-store'}})}
