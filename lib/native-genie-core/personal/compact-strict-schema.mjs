// ISOLATED OFFLINE CANDIDATE. No imports from this directory are wired into a service.
// Only JSON object property names change; identifiers, enum values, literals,
// nullable values, source text, evidence span IDs and array order are untouched.
export class CompactContractError extends Error {
  constructor(code){super(code);this.name='CompactContractError';this.code=code;}
}
const fail=code=>{throw new CompactContractError(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const schemaKeys=new Set(['type','properties','required','additionalProperties','items','anyOf','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','description']);
const own=(x,k)=>Object.hasOwn(x,k);
const clone=x=>structuredClone(x);

// This bounded evaluator deliberately implements exactly the keyword subset in
// the complete current personal-Dispo schema. Unknown schema keywords fail at
// compilation instead of being silently ignored. It is not a general validator.
function checkSchema(schema,names,depth=0){
  if(!object(schema)||depth>64||Object.keys(schema).some(k=>!schemaKeys.has(k)))fail('unsupported_schema');
  if(schema.anyOf!==undefined){
    if(!Array.isArray(schema.anyOf)||!schema.anyOf.length||schema.anyOf.length>8)fail('unsupported_schema');
    for(const branch of schema.anyOf)checkSchema(branch,names,depth+1);
  }
  if(schema.type!==undefined&&!['object','array','string','integer','number','boolean','null'].includes(schema.type))fail('unsupported_schema');
  if(schema.type==='object'){
    if(schema.additionalProperties!==false||!object(schema.properties)||!Array.isArray(schema.required)||new Set(schema.required).size!==schema.required.length||schema.required.length!==Object.keys(schema.properties).length||schema.required.some(k=>!own(schema.properties,k)))fail('non_closed_schema');
    for(const [name,child] of Object.entries(schema.properties)){names.add(name);checkSchema(child,names,depth+1);}
  }else if(schema.properties!==undefined||schema.required!==undefined||schema.additionalProperties!==undefined)fail('unsupported_schema');
  if(schema.type==='array'){if(!schema.items)fail('unsupported_schema');checkSchema(schema.items,names,depth+1);}
  else if(schema.items!==undefined)fail('unsupported_schema');
  if(!schema.anyOf&&!schema.type)fail('unsupported_schema');
  if(schema.enum!==undefined&&(!Array.isArray(schema.enum)||!schema.enum.length))fail('unsupported_schema');
  for(const name of ['minimum','maximum','minLength','maxLength','minItems','maxItems'])if(schema[name]!==undefined&&(!Number.isFinite(schema[name])||(['minLength','maxLength','minItems','maxItems'].includes(name)&&(!Number.isSafeInteger(schema[name])||schema[name]<0))))fail('unsupported_schema');
}
function matches(value,schema,depth=0){
  if(depth>64)return false;
  if(schema.anyOf&&!schema.anyOf.some(branch=>matches(value,branch,depth+1)))return false;
  const type=schema.type;
  if(type==='object'){
    if(!object(value)||schema.required.some(k=>!own(value,k))||Object.keys(value).some(k=>!own(schema.properties,k)))return false;
    for(const [key,child] of Object.entries(schema.properties))if(own(value,key)&&!matches(value[key],child,depth+1))return false;
  }else if(type==='array'){
    if(!Array.isArray(value)||(schema.minItems!==undefined&&value.length<schema.minItems)||(schema.maxItems!==undefined&&value.length>schema.maxItems)||!value.every(item=>matches(item,schema.items,depth+1)))return false;
  }else if(type==='string'){
    if(typeof value!=='string')return false;
    const length=[...value].length;
    if(schema.minLength!==undefined&&length<schema.minLength||schema.maxLength!==undefined&&length>schema.maxLength)return false;
  }else if(type==='integer'||type==='number'){
    if(typeof value!=='number'||!Number.isFinite(value)||(type==='integer'&&!Number.isInteger(value))||schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum)return false;
  }else if(type==='boolean'){if(typeof value!=='boolean')return false;}
  else if(type==='null'){if(value!==null)return false;}
  if(schema.enum&&!schema.enum.some(item=>JSON.stringify(item)===JSON.stringify(value)))return false;
  return true;
}
export function validateStrictSchema(value,schema){checkSchema(schema,new Set());if(!matches(value,schema))fail('schema_mismatch');return value;}
function aliasAt(index){let result='';do{result=String.fromCharCode(97+index%26)+result;index=Math.floor(index/26)-1;}while(index>=0);return result;}
function schemaBranch(value,schema){return schema.anyOf?schema.anyOf.find(branch=>matches(value,branch)):schema;}
function mapValue(value,schema,aliases,reverse=false){
  const branch=schemaBranch(value,schema);if(!branch)fail('schema_mismatch');
  if(branch.type==='array')return value.map(item=>mapValue(item,branch.items,aliases,reverse));
  if(branch.type==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>{
    const original=reverse?aliases.reverse.get(key):key;
    const child=branch.properties[reverse?key:original];
    if(original===undefined||!child)fail('unknown_alias');
    return [reverse?original:aliases.forward.get(original),mapValue(item,child,aliases,reverse)];
  }));
  return value;
}
function mapSchema(schema,forward){
  const copy=clone(schema);
  if(copy.anyOf)copy.anyOf=copy.anyOf.map(branch=>mapSchema(branch,forward));
  if(copy.type==='array')copy.items=mapSchema(copy.items,forward);
  if(copy.type==='object'){
    copy.properties=Object.fromEntries(Object.entries(copy.properties).map(([name,child])=>{
      const mapped=mapSchema(child,forward);
      mapped.description=`Original property: ${name}.`+(child.description?' '+child.description:'');
      return [forward.get(name),mapped];
    }));copy.required=copy.required.map(name=>forward.get(name));
  }
  return copy;
}
export function createCompactDispoContract(fullSchema,{aliasEntries}={}){
  const canonicalSchema=clone(fullSchema),names=new Set();checkSchema(canonicalSchema,names);
  if(canonicalSchema.type!=='object'||Object.keys(canonicalSchema.properties).length!==1||!own(canonicalSchema.properties,'days')||!names.has('spanID')||names.has('page')||names.has('quote'))fail('not_personal_dispo_span_schema');
  const sorted=[...names].sort();let next=0;
  const entries=aliasEntries===undefined?sorted.map(name=>[name,name==='spanID'?'spanID':aliasAt(next++)]):clone(aliasEntries);
  if(!Array.isArray(entries)||entries.length!==sorted.length)fail('invalid_alias_map');
  const forward=new Map(),reverse=new Map();
  for(const pair of entries){
    if(!Array.isArray(pair)||pair.length!==2)fail('invalid_alias_map');
    const [original,alias]=pair;
    if(!names.has(original)||typeof alias!=='string'||!(/^[a-z]+$/.test(alias)||original==='spanID'&&alias==='spanID')||forward.has(original)||reverse.has(alias)||original==='spanID'&&alias!=='spanID')fail('invalid_alias_map');
    forward.set(original,alias);reverse.set(alias,original);
  }
  if(sorted.some(name=>!forward.has(name)))fail('invalid_alias_map');
  const compactSchema=mapSchema(canonicalSchema,forward);checkSchema(compactSchema,new Set());
  const aliases={forward,reverse};
  const encode=value=>{if(!matches(value,canonicalSchema))fail('schema_mismatch');const output=mapValue(value,canonicalSchema,aliases);if(!matches(output,compactSchema))fail('schema_mismatch');return output;};
  const restore=value=>{if(!matches(value,compactSchema))fail('schema_mismatch');const output=mapValue(value,compactSchema,aliases,true);if(!matches(output,canonicalSchema))fail('schema_mismatch');return output;};
  const mapping=sorted.map(original=>({original,alias:forward.get(original)}));
  const instructions=`WIRE FORMAT ONLY. All semantic rules above use original property names and describe the server-restored document. For emitted JSON object PROPERTY NAMES ONLY, use this exact original-to-wire mapping: ${JSON.stringify(Object.fromEntries(mapping.map(x=>[x.original,x.alias])))}. The strict wire schema is authoritative. Do not emit original property names unless they map to themselves. Never translate, shorten, alias or recalculate string VALUES: all IDs, personIDs elements, kind values, source span IDs, dates, literals, unit labels and source text stay byte-for-byte unchanged. Evidence is carried ONLY in arrays under the alias for evidence, whose items are exactly {"spanID":"<allowed exact source span ID>"}; spanID itself is deliberately NOT aliased. NEVER emit page/quote, copied source quotations, or an additional evidence representation. The server restores aliases first, then unchanged exact-source evidence and the unchanged full semantic validator run. Nulls, empty lists, every record and source-array order remain unchanged. This wire-key rule resolves earlier references to original JSON field names; it does not change their meanings.`;
  return {schema:clone(compactSchema),mapping:clone(mapping),instructions,encode,restore,parseAndRestore:source=>restore(parseCompactJSON(source))};
}

// JSON.parse silently accepts repeated property names. Check raw model JSON
// before parsing so duplicate and escaped-equivalent aliases are hard errors.
export function parseCompactJSON(source,{maximumBytes=4*1024*1024}={}){
  if(typeof source!=='string'||!Number.isSafeInteger(maximumBytes)||maximumBytes<1||Buffer.byteLength(source)>maximumBytes)fail('compact_json_too_large');
  let offset=0,nodes=0;
  const whitespace=()=>{while(/[\t\n\r ]/.test(source[offset]??'')&&offset<source.length)offset++;};
  const string=()=>{
    if(source[offset]!== '"')fail('invalid_json');const begin=offset++;
    while(offset<source.length){const c=source[offset++];if(c==='"'){try{return JSON.parse(source.slice(begin,offset));}catch{fail('invalid_json');}}if(c==='\\'){if(offset>=source.length)fail('invalid_json');offset++;}else if(c.charCodeAt(0)<32)fail('invalid_json');}
    fail('invalid_json');
  };
  const value=depth=>{
    if(depth>64||++nodes>maximumBytes)fail('compact_json_too_large');whitespace();const c=source[offset];
    if(c==='{'){
      offset++;whitespace();const keys=new Set();if(source[offset]==='}'){offset++;return;}
      for(;;){whitespace();const key=string();if(keys.has(key))fail('duplicate_alias');keys.add(key);whitespace();if(source[offset++]!==':')fail('invalid_json');value(depth+1);whitespace();const end=source[offset++];if(end==='}')return;if(end!==',')fail('invalid_json');}
    }
    if(c==='['){offset++;whitespace();if(source[offset]===']'){offset++;return;}for(;;){value(depth+1);whitespace();const end=source[offset++];if(end===']')return;if(end!==',')fail('invalid_json');}}
    if(c==='"'){string();return;}
    for(const literal of ['true','false','null'])if(source.startsWith(literal,offset)){offset+=literal.length;return;}
    const number=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(offset));
    if(number){offset+=number[0].length;return;}fail('invalid_json');
  };
  value(0);whitespace();if(offset!==source.length)fail('invalid_json');
  try{return JSON.parse(source);}catch{fail('invalid_json');}
}
