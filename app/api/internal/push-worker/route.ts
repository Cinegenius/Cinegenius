import {authorizedListingFreshnessCron} from '@/lib/listing-freshness-cron-auth';
import {runNativePushWorker} from '@/lib/native-push-worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=150;
const headers={'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'};
export async function POST(request:Request){
 if(!authorizedListingFreshnessCron(request.headers.get('authorization'),process.env.CRON_SECRET))return Response.json({error:{code:'unauthorized'}},{status:401,headers});
 try{return Response.json(await runNativePushWorker(),{headers});}catch{return Response.json({error:{code:'unavailable'}},{status:503,headers});}
}
export function HEAD(){return new Response(null,{status:405,headers:{...headers,Allow:'POST'}})}
export const GET=HEAD;
