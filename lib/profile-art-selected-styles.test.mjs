import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HUMAN_AVATAR_STYLES,ANIMAL_AVATAR_STYLES,AVATAR_STYLE_VERSION,selectedAvatarStyle} from './profile-art-selected-styles.ts';
import {profileArtPrompt} from './profile-art-producer.ts';
import {createProfileArtReviewer} from './profile-art-reviewer.ts';
const job=(id=randomUUID(),presentation='neutral')=>({id,kind:'avatar',presentation,mediaKey:randomUUID(),token:randomUUID(),expiresAt:new Date(Date.now()+90_000).toISOString()});
test('exactly the approved 11 human and 13 animal choices, with no duplicate human #11',()=>{
 assert.deepEqual(HUMAN_AVATAR_STYLES.map(s=>s.number),[11,13,15,17,19,31,32,36,37,38,39]);
 assert.deepEqual(ANIMAL_AVATAR_STYLES.map(s=>s.number),[1,2,4,5,6,8,10,11,14,15,17,19,20]);
 assert.equal(new Set([...HUMAN_AVATAR_STYLES,...ANIMAL_AVATAR_STYLES].map(s=>s.id)).size,24);
});
test('all selected styles are reachable; feminine and masculine stock remains human and neutral stock mixes both',()=>{
 const seen=new Set();
 for(let i=0;i<512;i++) {
  const id=`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`;
  const neutral=job(id);seen.add(selectedAvatarStyle(neutral).id);
  assert.equal(profileArtPrompt(neutral),profileArtPrompt({...neutral,token:randomUUID(),expiresAt:'later'}),'lease changes never change the image brief');
  for(const presentation of ['feminine','masculine'])assert.ok(!('subject' in selectedAvatarStyle({...neutral,presentation})));
 }
 assert.deepEqual(seen,new Set([...HUMAN_AVATAR_STYLES,...ANIMAL_AVATAR_STYLES].map(s=>s.id)));
});
test('producer and independent reviewer share the selected animal subject and persist style provenance',async()=>{
 let animal;
 for(let i=0;i<512;i++) {const candidate=job(`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`);if('subject' in selectedAvatarStyle(candidate)){animal=candidate;break;}}
 assert.ok(animal);const style=selectedAvatarStyle(animal);let request;
 const review=await createProfileArtReviewer({apiKey:'fixture-only',fetcher:async(_url,init)=>{request=JSON.parse(init.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({accepted:true,description:'An original tilted animal head in loose expressive graphic shapes.'})}]}]});}})(animal,new Uint8Array([1]));
 assert.equal(request.input[0].content[0].text,profileArtPrompt(animal));
 assert.ok(request.input[0].content[0].text.includes(`one illustrated ${style.subject}`));
 assert.match(request.instructions,/Human and animal avatars/);assert.match(request.instructions,/misregistered ink/);
 assert.equal(review.styleVersion,AVATAR_STYLE_VERSION);assert.equal(review.styleId,style.id);
 assert.equal(review.policy,'cg-silhouette-nature-v1','database review protocol remains compatible');
 assert.equal(request.model,'gpt-5.4-mini');assert.equal(request.store,false);assert.equal(request.tools,undefined);
});
test('covers retain the separate peaceful graphic nature brief, without selected animal/human directions',()=>{
 const text=profileArtPrompt({...job(),kind:'cover',presentation:null});
 assert.match(text,/Peaceful natural landscape/);assert.match(text,/no animals or people/);
 assert.ok(!text.includes(AVATAR_STYLE_VERSION));
});

test('winter brief is durable, neutral and never consumes the seven finite holiday identities',()=>{
 for(let i=0;i<80;i++){
  const a={...job(),seasonalEdition:'winter-2026'},prompt=profileArtPrompt(a);
  assert.match(prompt,/Seasonal edition winter-2026/);assert.match(prompt,/No religious symbols or figures/);
  assert.match(prompt,/Santa\/Nikolaus, elves, reindeer/);assert.notEqual(selectedAvatarStyle(a).id,'deer-mosaic');
  assert.equal(prompt,profileArtPrompt({...a,expiresAt:'2027-01-01',token:randomUUID()}));
  assert.doesNotMatch(profileArtPrompt({...a,seasonalEdition:null}),/Seasonal edition/);
 }
});
