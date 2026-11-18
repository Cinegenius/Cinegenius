import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
import{createProfileArtReviewer}from'./profile-art-reviewer.ts';
import{profileArtPrompt}from'./profile-art-producer.ts';
import{validProfileArtSave}from'./profile-art-save.ts';
const job={id:randomUUID(),kind:'avatar',presentation:'feminine',mediaKey:randomUUID(),token:randomUUID(),expiresAt:new Date(Date.now()+90_000).toISOString()};
const result=review=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(review)}]}]});
test('fixed reviewer has no storage, private member data, arbitrary instructions or tools',async()=>{
 let request;const review=await createProfileArtReviewer({apiKey:'fixture-only',fetcher:async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');request=JSON.parse(init.body);assert.equal(init.redirect,'error');return result({accepted:true,description:'Dark silhouette with swept hair on a quiet green backdrop.'});}})(job,new Uint8Array([1,2,3]));
 assert.equal(review.accepted,true);assert.equal(review.policy,'cg-silhouette-nature-v1');assert.equal(request.store,false);assert.equal(request.model,'gpt-5.4-mini');assert.ok(request.max_output_tokens<=1200);assert.equal(request.tools,undefined);assert.match(request.input[0].content[0].text,/feminine-presenting/);assert.match(request.input[0].content[1].image_url,/^data:image\/webp;base64,/);
});
test('a rejected style stays rejected; invalid, incomplete, refusal, oversized and unavailable reviews fail closed',async()=>{
 const good={accepted:false,description:'Busy portrait with visible facial features and technical patterns.'};
 assert.equal((await createProfileArtReviewer({apiKey:'fixture',fetcher:async()=>result(good)})(job,new Uint8Array([1]))).accepted,false);
 for(const fetcher of [async()=>result({accepted:'yes',description:good.description}),async()=>result({accepted:true,description:'ok'}),async()=>Response.json({status:'incomplete',output:[]}),async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}),async()=>new Response(' '.repeat(33000),{headers:{'content-type':'application/json'}}),async()=>new Response('',{status:429})])await assert.rejects(createProfileArtReviewer({apiKey:'fixture',fetcher})(job,new Uint8Array([1])));
 await assert.rejects(createProfileArtReviewer({fetcher:()=>{throw Error('must not call')}})(job,new Uint8Array([1])),/review_unavailable/);
});
test('all optional presentations have specific briefs; covers reject discarded styles',()=>{
 for(const presentation of ['feminine','masculine','neutral'])assert.match(profileArtPrompt({...job,presentation}),/silhouette/);
 const cover=profileArtPrompt({...job,kind:'cover',presentation:null});assert.match(cover,/Peaceful natural landscape/);assert.match(cover,/no animals or people/);assert.match(cover,/No text, logos/);
});
test('deletion is explicit and bounded, separate from ordinary empty image fields',()=>{
 const base={requestKey:randomUUID(),expectedUpdatedAt:new Date().toISOString(),choices:[],deletions:[{kind:'avatar',mediaKey:randomUUID()}]};assert.equal(validProfileArtSave(base),true);
 assert.equal(validProfileArtSave({...base,deletions:[]}),false);assert.equal(validProfileArtSave({...base,deletions:[...base.deletions,...base.deletions]}),false);assert.equal(validProfileArtSave({...base,deletions:[{kind:'avatar',mediaKey:randomUUID(),userId:'other'}]}),false);
});
