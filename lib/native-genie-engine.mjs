import {AnalysisError as DispoError} from './native-genie-core/personal/core.mjs';
import {validatePersonalDispoRequest,executePersonalDispo} from './native-genie-core/personal/personal-dispo-core.mjs';
import {createCompactPersonalDispoProvider} from './native-genie-core/personal/compact-provider.mjs';
import {AnalysisError as WorkError} from './native-genie-core/work/core.mjs';
import {validateWorkRequest,prepareWorkContext,executeWorkTask} from './native-genie-core/work/work-task-core.mjs';
import {createWorkTaskProvider} from './native-genie-core/work/work-task-provider.mjs';

// Only the authenticated wrapper may select a kind or construct a provider.
// Core validators retain the approved private source; prompt selection is server-owned.
export function validateNativeGenieInput(kind,input){
 if(kind==='personal-dispo'){validatePersonalDispoRequest(input);return;}
 if(kind==='work-task'){validateWorkRequest(input);prepareWorkContext(input);return;}
 // The currently approved private transport has no screenplay endpoint. Do not
 // silently select a different model/pipeline for that older client.
 throw new DispoError('unavailable',503);
}
// Return only a closed area. Never export the original path or its indices.
function rejectionAreaFromPath(value){
 if(value==='root')return 'root';
 if(typeof value!=='string'||value.length>100)return 'unknown';
 const match=/^days\[(?:0|[1-9]\d*)\](?:\.(people|times|locations|notes|contacts)\[(?:0|[1-9]\d*)\])?$/.exec(value);
 // JavaScript $ also matches before a trailing newline: require the full string.
 return match&&match[0]===value?(match[1]??'day'):'unknown';
}
export function nativeGenieEngineError(error){
 if(error instanceof DispoError||error instanceof WorkError){
  const result={code:error.code,status:error.status,rejectionStage:'unknown',rejectionReason:'other',rejectionArea:'unknown'};
  try{
   const stages=['compact_wire','canonical_validation','recovery','provider','unknown'];
   const reasons=['duplicate_key','wire_schema_mismatch','invalid_union','wire_configuration','canonical_schema','recovery_schema','other'];
   const rawValidationStage=error.validationStage,rawStage=error.rejectionStage,rawReason=error.rejectionReason;
   const fallback=rawValidationStage==='validation'?'canonical_validation':rawValidationStage==='provider'?'provider':'unknown';
   const rejectionStage=stages.includes(rawStage)?rawStage:fallback;
   const rejectionReason=reasons.includes(rawReason)?rawReason:
    rejectionStage==='canonical_validation'&&result.code==='invalid_schema'?'canonical_schema':'other';
   const rejectionArea=['canonical_validation','recovery'].includes(rejectionStage)?rejectionAreaFromPath(error.validationPath):'unknown';
   Object.assign(result,{rejectionStage,rejectionReason,rejectionArea});
  }catch{/* Diagnostics must never replace the original code/status. */}
  return result;
 }
 return null;
}
export function createNativeGenieEngine(apiKey,{fetchImpl}={}){
 let personal,work;
 return async(kind,input,{signal,beforeProvider})=>{
  if(kind==='personal-dispo'){
   personal??=createCompactPersonalDispoProvider(apiKey,{allowNetwork:true,promptVariant:'focused',reasoningEffort:'medium',serviceTier:'ultrafast',...(fetchImpl?{fetchImpl}:{})});
   return executePersonalDispo(input,{provider:personal,signal,beforeProvider});
  }
  if(kind==='work-task'){
   work??=createWorkTaskProvider(apiKey,fetchImpl?{fetchImpl}:{});
   return executeWorkTask(input,{provider:work,signal,beforeProvider});
  }
  throw new DispoError('unavailable',503);
 };
}
