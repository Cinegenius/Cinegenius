import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@clerk/nextjs/server';
import {isAppLocale} from '@/lib/i18n/locales';
import {COUNTRY_CODES} from '@/lib/places/countries';
import {DISCOVERY_PLACE_AREAS,DISCOVERY_PLACE_SURFACES,discoveryCityOptions,type DiscoveryPlaceArea,type DiscoveryPlaceSurface} from '@/lib/discovery-place-options';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Vary':'Cookie, Accept-Language','X-Content-Type-Options':'nosniff'};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:HEADERS});
export async function GET(request:NextRequest){
 const params=request.nextUrl.searchParams,mode=params.get('mode'),locale=params.get('locale')??'de';
 if(!isAppLocale(locale)||!['cities','countries'].includes(mode??'')||[...params.keys()].some(key=>params.getAll(key).length!==1))return respond({version:1,code:'invalid'},400);
 if(mode==='cities'){
  // Catalogue-only path deliberately does not await Clerk/DB/inventory services.
  const query=params.get('q')??'',country=params.get('country')??'',city=params.get('city')??'';
  if(query.length>120||/[\u0000-\u001f\u007f]/.test(query)||country!==''&&!COUNTRY_CODES.includes(country as typeof COUNTRY_CODES[number])||city!==''&&!/^geonames:[0-9]{1,12}$/.test(city))return respond({version:1,code:'invalid'},400);
  return respond({version:1,mode:'cities',cities:discoveryCityOptions(query,locale,country,city)});
 }
 const surface=params.get('surface');if(!DISCOVERY_PLACE_SURFACES.includes(surface as DiscoveryPlaceSurface))return respond({version:1,code:'invalid'},400);
 const raw=params.get('areas');if(raw===null||raw.length>100)return respond({version:1,code:'invalid'},400);
 const items=raw===''?[]:raw.split(',');if(items.some(area=>!DISCOVERY_PLACE_AREAS.includes(area as DiscoveryPlaceArea))||new Set(items).size!==items.length)return respond({version:1,code:'invalid'},400);
 const areas=DISCOVERY_PLACE_AREAS.filter(area=>items.includes(area));
 try{const{userId}=await auth();const{discoveryInventoryCountries}=await import('@/lib/discovery-place-options-server');const countries=await discoveryInventoryCountries(areas,locale,userId,request.signal,surface as DiscoveryPlaceSurface);return respond({version:1,mode:'countries',surface,accountId:userId,areas,countries});}
 catch{return respond({version:1,code:'unavailable'},503);}
}
