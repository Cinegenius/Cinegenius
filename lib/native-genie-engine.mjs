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
export function nativeGenieEngineError(error){
 if(error instanceof DispoError||error instanceof WorkError)return{code:error.code,status:error.status};
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
