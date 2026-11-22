import {AnalysisError} from './core.mjs';
import {readProviderJSON} from './provider.mjs';

// Candidate adapter; the original corpus provider stays pinned as baseline.
export function createQualityFetch({fetchImpl=fetch,effort='medium',allowPersonalDispoOutputLimit=false}={}) {
 if(!['low','medium','high'].includes(effort)||typeof allowPersonalDispoOutputLimit!=='boolean')throw new AnalysisError('invalid_configuration',503);
 const model='gpt-6.1-sol';let access;
 return async(url,options,personalDispoOutputLimit)=>{
  const outputLimit=allowPersonalDispoOutputLimit&&Number.isSafeInteger(personalDispoOutputLimit)&&personalDispoOutputLimit>=8000&&personalDispoOutputLimit<=24000?personalDispoOutputLimit:24000;
  if(url!=='https://api.openai.com/v1/responses'||options?.method!=='POST')throw new AnalysisError('invalid_configuration',503);
  access??=(async()=>{
   const response=await fetchImpl('https://api.openai.com/v1/models/'+model,{method:'GET',headers:{Authorization:options.headers.Authorization},cache:'no-store',redirect:'error',signal:options.signal});
   if(!response.ok){
    await response.body?.cancel().catch(()=>{});
    if(response.status===429)throw new AnalysisError('provider_rate_limited',429);
    if(response.status>=500)throw new AnalysisError('provider_unavailable',503);
    return false;
   }
   return (await readProviderJSON(response))?.id===model;
  })().catch(error=>{access=undefined;throw error;});
  if(!await access)return new Response('{"error":{"code":"model_not_available"}}',{status:404,headers:{'Content-Type':'application/json'}});
  const body=JSON.parse(options.body);
  const response=await fetchImpl(url,{...options,body:JSON.stringify({...body,model,reasoning:{effort},max_output_tokens:outputLimit})});
  if(!response.ok)return response;
  const payload=await readProviderJSON(response);
  // Thinking metadata is not a source fact. Unknown tool/output types remain
  // present, so the unchanged strict decoder rejects them.
  if(Array.isArray(payload?.output))payload.output=payload.output.filter(item=>item?.type!=='reasoning');
  return new Response(JSON.stringify(payload),{status:response.status,headers:{'Content-Type':'application/json'}});
 };
}
