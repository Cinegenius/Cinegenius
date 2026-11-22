// ISOLATED OFFLINE CONTRACT. No production/service/native import or network.
// This layer changes only closed-schema wire keys, enum codes and span IDs.
// It fully restores the exact original raw draft before unchanged validators.
import {validateStrictSchema,parseCompactJSON} from './compact-strict-schema.mjs';

export class CompactWireError extends Error {
 constructor(code){super(code);this.name='CompactWireError';this.code=code;}
}
const fail=code=>{throw new CompactWireError(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const own=(x,k)=>Object.hasOwn(x,k);
const clone=structuredClone;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function tokenAt(index,alphabet){let token='';do{token=alphabet[index%alphabet.length]+token;index=Math.floor(index/alphabet.length)-1;}while(index>=0);return token;}
const letters='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const codes=letters+'0123456789';
function aliases(values,entries,kind,alphabet){
 const originals=[...values].sort(),allowed=new Set(originals);
 if(entries===undefined)entries=originals.map((v,i)=>[v,tokenAt(i,alphabet)]);
 if(!Array.isArray(entries)||entries.length!==originals.length)fail('invalid_'+kind+'_mapping');
 const forward=new Map(),reverse=new Map();
 for(const pair of entries){
  if(!Array.isArray(pair)||pair.length!==2)fail('invalid_'+kind+'_mapping');
  const [original,alias]=pair;
  if(!allowed.has(original)||typeof alias!=='string'||!(kind==='key'?/^[a-zA-Z]{1,4}$/:/^[a-zA-Z0-9]{1,4}$/).test(alias)||forward.has(original)||reverse.has(alias))fail('invalid_'+kind+'_mapping');
  forward.set(original,alias);reverse.set(alias,original);
 }
 if(originals.some(v=>!forward.has(v)))fail('invalid_'+kind+'_mapping');
 return {forward,reverse,entries:originals.map(v=>[v,forward.get(v)])};
}
function validate(value,schema){
 try{return validateStrictSchema(value,schema);}catch{fail('schema_mismatch');}
}
function supportedSchema(schema){
 // The reused bounded evaluator checks its complete supported keyword subset
 // BEFORE matching. undefined cannot satisfy this required object root.
 try{validateStrictSchema(undefined,schema);fail('unsupported_schema');}
 catch(error){if(error?.code!=='schema_mismatch')fail('unsupported_schema');}
}
function sourceDictionary(spans){
 if(!Array.isArray(spans)||!spans.length||spans.length>1000)fail('invalid_span_dictionary');
 const ids=new Set();
 for(const span of spans){
  if(!object(span)||typeof span.id!=='string'||!/^p[1-9]\d*-\d+-\d+$/.test(span.id)||ids.has(span.id)||!Number.isSafeInteger(span.page)||span.page<1||typeof span.text!=='string'||!span.text.length)fail('invalid_span_dictionary');
  ids.add(span.id);
 }
 return ids;
}
function collect(schema,names,enums,spanIDs,field){
 if(schema.enum!==undefined){
  if(schema.type!=='string'||schema.enum.some(v=>typeof v!=='string'||!v.length)||new Set(schema.enum).size!==schema.enum.length)fail('unsupported_enum');
  if(field==='spanID'){
   if(schema.enum.length!==spanIDs.size||schema.enum.some(v=>!spanIDs.has(v)))fail('schema_span_dictionary_mismatch');
  }else{
   if(field!=='kind')fail('unsupported_enum_field');
   for(const value of schema.enum)enums.add(value);
  }
 }
 if(schema.anyOf)for(const branch of schema.anyOf)collect(branch,names,enums,spanIDs,field);
 if(schema.type==='array')collect(schema.items,names,enums,spanIDs,field);
 if(schema.type==='object')for(const [key,child] of Object.entries(schema.properties)){names.add(key);collect(child,names,enums,spanIDs,key);}
}
function remapSchema(schema,maps,field){
 const out=clone(schema);
 if(schema.enum){
  const mapping=field==='spanID'?maps.spans:maps.enums;
  out.enum=schema.enum.map(v=>mapping.forward.get(v));
  if(out.enum.some(v=>v===undefined))fail('missing_enum_mapping');
  // These constraints apply to wire codes here. The original constraints are
  // preserved and checked again after decoding, never bypassed.
  if(schema.minLength!==undefined)out.minLength=Math.min(...out.enum.map(v=>[...v].length));
  if(schema.maxLength!==undefined)out.maxLength=Math.max(...out.enum.map(v=>[...v].length));
 }
 if(schema.anyOf)out.anyOf=schema.anyOf.map(branch=>remapSchema(branch,maps,field));
 if(schema.type==='array')out.items=remapSchema(schema.items,maps,field);
 if(schema.type==='object'){
  out.properties=Object.fromEntries(Object.entries(schema.properties).map(([key,child])=>[maps.keys.forward.get(key),remapSchema(child,maps,key)]));
  out.required=schema.required.map(key=>maps.keys.forward.get(key));
 }
 return out;
}
function accepts(value,schema){try{validateStrictSchema(value,schema);return true;}catch{return false;}}
function branchFor(value,schema){
 if(!schema.anyOf)return schema;
 const branches=schema.anyOf.filter(s=>accepts(value,s));
 if(branches.length!==1)fail('ambiguous_or_invalid_schema_branch');
 return branches[0];
}
function encodeValue(value,schema,maps,field){
 const branch=branchFor(value,schema);
 if(branch.type==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[maps.keys.forward.get(key),encodeValue(item,branch.properties[key],maps,key)]));
 if(branch.type==='array')return value.map(item=>encodeValue(item,branch.items,maps,field));
 if(branch.enum){const v=(field==='spanID'?maps.spans:maps.enums).forward.get(value);if(v===undefined)fail('unknown_enum_value');return v;}
 return value;
}
function decodeValue(value,original,wire,maps,field){
 if(wire.anyOf){
  const indexes=wire.anyOf.flatMap((s,i)=>accepts(value,s)?[i]:[]);
  if(indexes.length!==1)fail('ambiguous_or_invalid_schema_branch');
  return decodeValue(value,original.anyOf[indexes[0]],wire.anyOf[indexes[0]],maps,field);
 }
 if(wire.type==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>{
  const name=maps.keys.reverse.get(key);
  if(name===undefined||!own(original.properties,name)||!own(wire.properties,key))fail('unknown_key');
  return [name,decodeValue(item,original.properties[name],wire.properties[key],maps,name)];
 }));
 if(wire.type==='array')return value.map(item=>decodeValue(item,original.items,wire.items,maps,field));
 if(wire.enum){const v=(field==='spanID'?maps.spans:maps.enums).reverse.get(value);if(v===undefined)fail('unknown_enum_code');return v;}
 return value;
}

export function createCompactWireContract(fullSchema,sourceSpans,{keyAliases,enumAliases,spanAliases}={}){
 const original=clone(fullSchema),spanIDs=sourceDictionary(sourceSpans);
 supportedSchema(original);
 if(original.type!=='object'||!same(Object.keys(original.properties),['days']))fail('not_personal_dispo_span_schema');
 const names=new Set(),enums=new Set();collect(original,names,enums,spanIDs);
 if(!names.has('spanID')||names.has('page')||names.has('quote'))fail('not_personal_dispo_span_schema');
 const maps={keys:aliases(names,keyAliases,'key',letters),enums:aliases(enums,enumAliases,'enum',codes),spans:aliases(spanIDs,spanAliases,'span',codes)};
 const wire=remapSchema(original,maps);supportedSchema(wire);
 const keyMapping=Object.fromEntries(maps.keys.entries),enumMapping=Object.fromEntries(maps.enums.entries);
 const instructions=`WIRE ENCODING ONLY. Keep ALL previous semantic, source, identity, department, unit, date, row-binding and ambiguity rules. Emit only the strict wire schema. Original output JSON property names map to these globally unique wire keys: ${JSON.stringify(keyMapping)}. ONLY schema-enumerated kind VALUES map to these exact enum codes: ${JSON.stringify(enumMapping)}. This is a reversible enum encoding, not a meaning change. In the context, sourceSpans retain their exact original page and text but their id fields are short wire IDs; use ONLY those exact IDs in evidence references under the wire key for spanID. NEVER emit the old long span ID, an array index, page/quote or another evidence form. All evidence arrays remain explicitly required and nonempty; there is NO evidence inheritance. Do not shorten or alias arbitrary text, names, addresses, departments, units, phone/email, dates, literals, record IDs or personIDs. Preserve every record, null, empty list and array order. The server first restores original keys, enum values and span IDs, then runs the SAME original source restoration and full validators. Do not omit fields or facts to save space.`;
 const restore=value=>{validate(value,wire);const out=decodeValue(value,original,wire,maps);validate(out,original);return out;};
 return {
  schema:clone(wire),keyMapping,enumMapping,spanMapping:Object.fromEntries(maps.spans.entries),instructions,
  encode(value){validate(value,original);const out=encodeValue(value,original,maps);validate(out,wire);return out;},
  restore,
  parseAndRestore(text){let parsed;try{parsed=parseCompactJSON(text);}catch(error){fail(error?.code??'invalid_json');}return restore(parsed);},
  sourceSpans:sourceSpans.map(span=>({...clone(span),id:maps.spans.forward.get(span.id)}))
 };
}

export function createCompactWireProvider(underlying){
 if(typeof underlying!=='function')fail('explicit_provider_required');
 return async args=>{
  if(!object(args?.context)||args.context.kind!=='personal_dispo')fail('invalid_context');
  const contract=createCompactWireContract(args.schema,args.context.sourceSpans);
  const text=await underlying({...args,context:{...args.context,sourceSpans:clone(contract.sourceSpans)},schema:clone(contract.schema),instructions:args.instructions+'\n'+contract.instructions});
  // Require raw JSON text at this isolated boundary, so repeated/escaped-
  // equivalent keys can be rejected BEFORE a lossy JSON.parse step.
  if(typeof text!=='string')fail('raw_json_required');
  return contract.parseAndRestore(text);
 };
}
