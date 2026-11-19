import {nativePushRoute} from '@/lib/native-push-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>nativePushRoute(request,'capabilities');
export function HEAD(){return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'private, no-store'}})}
