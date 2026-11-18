import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {performance} from "node:perf_hooks";
import sharp from "sharp";
import {prepareProfileArtImage, PROFILE_ART_IMAGE_POLICY as policy} from "./profile-art-image-preparation.ts";

const fixture = name => readFile(new URL("../public/profile-art/v1/"+name,import.meta.url));
const empty = () => ({scope:"all-catalog-art",complete:true,snapshotID:"fixture-v1",entries:[]});
const against = (id,image) => ({...empty(),entries:[{artworkID:id,fingerprint:image.fingerprint}]});
const hash = value => createHash("sha256").update(value).digest("hex");
const summary = r => JSON.stringify({ok:r.ok,code:r.code,match:r.match,fingerprint:r.image?.fingerprint});
async function prepared(name="avatar-01.webp",kind="avatar",comparisons=empty()) {
  const result=await prepareProfileArtImage({kind,bytes:await fixture(name)},comparisons);
  assert.equal(result.ok,true,summary(result)); return result;
}
function crc32(bytes){let value=0xffffffff;for(const b of bytes){value^=b;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;}
function pngChunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}

test("both real approved raster kinds decode, encode, strip and retain bounded dimensions",async()=>{
  for(const [name,kind]of[["avatar-01.webp","avatar"],["cover-water.webp","cover"]]){
    const input=await fixture(name),before=hash(input);
    const r=await prepareProfileArtImage({kind,bytes:input},empty());assert.equal(r.ok,true,summary(r));
    assert.equal(r.status,"prepared_for_illustration_review");assert.equal(r.inventoryReady,false);assert.equal(r.requiresIllustrationReview,true);
    assert.equal(r.novelty.semanticUniquenessProven,false);assert.equal(r.novelty.compared,0);
    const target=policy.targets[kind],m=await sharp(r.image.bytes).metadata();
    assert.equal(m.width,target.width);assert.equal(m.height,target.height);assert.equal(m.format,"webp");
    for(const key of["exif","xmp","iptc","icc","orientation"])assert.equal(m[key],undefined,key);
    assert.ok(r.image.bytes.length<=target.maxBytes);assert.equal(r.image.byteSHA256,hash(r.image.bytes));
    assert.equal(hash(input),before,"input is never rewritten");
    assert.match(r.image.fingerprint.pixelSHA256,/^[0-9a-f]{64}$/);assert.match(r.image.fingerprint.pHash,/^[0-7][0-9a-f]{15}$/);
  }
});
test("file names and UUID labels do not influence pixels, output bytes or fingerprint",async()=>{
  const bytes=await fixture("avatar-01.webp");
  const a=await prepareProfileArtImage({kind:"avatar",bytes,filename:"a.png",uuid:"one"},empty());
  const b=await prepareProfileArtImage({kind:"avatar",bytes,filename:"other.webp",uuid:"two"},empty());
  assert.equal(a.ok,true);assert.equal(b.ok,true);assert.deepEqual(a.image.fingerprint,b.image.fingerprint);assert.equal(a.image.byteSHA256,b.image.byteSHA256);
});
test("lossless PNG encodings and metadata produce identical pixel hashes and cannot become new art",async()=>{
  const source=await fixture("avatar-01.webp");
  const a=await sharp(source).png({compressionLevel:0}).toBuffer();
  const b=await sharp(source).withMetadata({density:300}).png({compressionLevel:9}).toBuffer();
  assert.notEqual(hash(a),hash(b));assert.ok((await sharp(b).metadata()).exif);
  const first=await prepareProfileArtImage({kind:"avatar",bytes:a},empty());assert.equal(first.ok,true);
  const second=await prepareProfileArtImage({kind:"avatar",bytes:b},empty());assert.equal(second.ok,true);
  assert.deepEqual(first.image.fingerprint,second.image.fingerprint);
  const duplicate=await prepareProfileArtImage({kind:"avatar",bytes:b},against("original",first.image));
  assert.equal(duplicate.ok,false);assert.equal(duplicate.code,"duplicate_pixels");assert.equal(duplicate.inventoryReady,false);
});
test("JPEG and WebP re-encoding of the same artwork is conservatively held for structural similarity",async()=>{
  const original=await prepared(),source=await fixture("avatar-01.webp");
  for(const bytes of[await sharp(source).jpeg({quality:86}).toBuffer(),await sharp(source).webp({quality:70}).toBuffer()]){
    const result=await prepareProfileArtImage({kind:"avatar",bytes},against("existing",original.image));
    assert.equal(result.ok,false,summary(result));assert.ok(["duplicate_pixels","similar_structure"].includes(result.code),summary(result));
    assert.equal(result.match.artworkID,"existing");assert.equal(result.inventoryReady,false);
  }
});
test("simple brightness/contrast and recoloring do not qualify as new illustrations",async()=>{
  const first=await prepared(),source=await fixture("avatar-01.webp");
  for(const bytes of[await sharp(source).modulate({brightness:1.12,saturation:0.4}).png().toBuffer(),await sharp(source).linear(0.85,18).png().toBuffer(),await sharp(source).negate({alpha:false}).png().toBuffer()]){
    const r=await prepareProfileArtImage({kind:"avatar",bytes},against("same-illustration",first.image));
    assert.equal(r.ok,false,summary(r));assert.ok(["duplicate_pixels","similar_structure"].includes(r.code),summary(r));
  }
});
test("genuinely different approved avatar and cover fixtures remain distinguishable",async()=>{
  for(const[one,two,kind]of[["avatar-01.webp","avatar-14.webp","avatar"],["cover-water.webp","cover-moon.webp","cover"]]){
    const first=await prepared(one,kind),second=await prepared(two,kind,against("previous",first.image));
    assert.notEqual(first.image.fingerprint.pixelSHA256,second.image.fingerprint.pixelSHA256);
    assert.equal(second.novelty.compared,1);assert.equal(second.inventoryReady,false);
  }
});
test("incomplete/oversized/malformed comparison inventories fail closed",async()=>{
  const bytes=await fixture("avatar-01.webp"),first=await prepared();
  for(const[comparison,code]of[[{...empty(),complete:false},"comparison_set_incomplete"],[{...empty(),scope:"visible-only"},"comparison_set_incomplete"],[{...empty(),snapshotID:undefined},"invalid_comparison_set"],[{...empty(),entries:Array(policy.maxReferences+1).fill({})},"comparison_set_too_large"],[{...against("x",first.image),entries:[{artworkID:"x",fingerprint:{...first.image.fingerprint,pHash:"wrong"}}]},"invalid_comparison_set"]]){
    const r=await prepareProfileArtImage({kind:"avatar",bytes},comparison);assert.equal(r.ok,false);assert.equal(r.code,code);assert.equal(r.inventoryReady,false);
  }
  const duplicateRows=against("same",first.image);duplicateRows.entries.push(duplicateRows.entries[0]);
  assert.equal((await prepareProfileArtImage({kind:"avatar",bytes},duplicateRows)).code,"invalid_comparison_set");
});
test("comparison rows are captured before awaiting native work",async()=>{
  const original=await prepared(),comparison=against("existing",original.image);
  const pending=prepareProfileArtImage({kind:"avatar",bytes:await fixture("avatar-01.webp")},comparison);
  comparison.entries.length=0;comparison.snapshotID="mutated";
  const r=await pending;assert.equal(r.code,"duplicate_pixels");assert.equal(r.match.artworkID,"existing");
});
test("empty, too large, false kind and non-byte/URL input are typed rejections",async()=>{
  for(const[input,code]of[[{kind:"avatar",bytes:new Uint8Array()},"empty_input"],[{kind:"avatar",bytes:new Uint8Array(policy.maxInputBytes+1)},"input_too_large"],[{kind:"company",bytes:new Uint8Array([1])},"invalid_input"],[{kind:"avatar",bytes:"https://example.invalid/image.png"},"invalid_input"]]){
    const r=await prepareProfileArtImage(input,empty());assert.equal(r.ok,false);assert.equal(r.code,code);
  }
});
test("SVG, GIF, TIFF, PDF, URL text and signature lies never become prepared pictures",async()=>{
  for(const bytes of[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/never"/></svg>'),Buffer.from("GIF89a"),Buffer.from("II*\0"),Buffer.from("%PDF-1.7"),Buffer.from("https://example.invalid/image.png"),Buffer.from([255,216,255,0,0,0,0])]){
    const r=await prepareProfileArtImage({kind:"avatar",bytes},empty());assert.equal(r.ok,false);assert.equal(r.inventoryReady,false);assert.ok(["unsupported_format","decode_failed"].includes(r.code));
  }
});
test("truncated containers, animation chunks and declared pixel bombs are rejected before publication",async()=>{
  const source=await fixture("avatar-01.webp"),png=await sharp(source).png().toBuffer();
  const animation=Buffer.alloc(8);animation.writeUInt32BE(2,0);
  const apng=Buffer.concat([png.subarray(0,33),pngChunk("acTL",animation),png.subarray(33)]);
  assert.equal((await prepareProfileArtImage({kind:"avatar",bytes:apng},empty())).code,"animation_not_allowed");
  const animWebP=Buffer.concat([source,Buffer.from("ANIM"),Buffer.alloc(4)]);animWebP.writeUInt32LE(animWebP.length-8,4);
  assert.equal((await prepareProfileArtImage({kind:"avatar",bytes:animWebP},empty())).code,"animation_not_allowed");
  const bomb=Buffer.from(png);bomb.writeUInt32BE(8193,16);bomb.writeUInt32BE(1,20);bomb.writeUInt32BE(crc32(bomb.subarray(12,29)),29);
  assert.equal((await prepareProfileArtImage({kind:"avatar",bytes:bomb},empty())).code,"input_pixel_limit");
  const area=Buffer.from(png);area.writeUInt32BE(4097,16);area.writeUInt32BE(4097,20);area.writeUInt32BE(crc32(area.subarray(12,29)),29);
  assert.equal((await prepareProfileArtImage({kind:"avatar",bytes:area},empty())).code,"input_pixel_limit");
  for(const broken of[png.subarray(0,png.length-3),source.subarray(0,source.length-7)])assert.equal((await prepareProfileArtImage({kind:"avatar",bytes:broken},empty())).code,"invalid_container");
});
test("admission has no unbounded queue; cancellation discards output and releases capacity",async()=>{
  const bytes=await fixture("cover-water.webp"),controller=new AbortController();
  const first=prepareProfileArtImage({kind:"cover",bytes},empty(),{signal:controller.signal});
  const overlap=await prepareProfileArtImage({kind:"cover",bytes},empty());assert.equal(overlap.code,"busy");
  controller.abort();assert.equal((await first).code,"aborted");
  assert.equal((await prepareProfileArtImage({kind:"cover",bytes},empty(),{signal:controller.signal})).code,"aborted");
  const next=await prepareProfileArtImage({kind:"cover",bytes},empty());assert.equal(next.ok,true,summary(next));
});
test("metadata orientation is normalized and no original Exif/XMP/ICC survives",async()=>{
  const bytes=await sharp(await fixture("cover-water.webp")).withMetadata({orientation:6,density:240}).jpeg({quality:90}).toBuffer();
  assert.equal((await sharp(bytes).metadata()).orientation,6);
  const r=await prepareProfileArtImage({kind:"cover",bytes},empty());assert.equal(r.ok,true,summary(r));
  const m=await sharp(r.image.bytes).metadata();assert.equal(m.width,1500);assert.equal(m.height,600);
  for(const key of["orientation","exif","xmp","iptc","icc"])assert.equal(m[key],undefined);
});
test("low-information rasters cannot silently become novel illustrations",async()=>{
  const bytes=await sharp(await fixture("avatar-01.webp")).resize(1,1).png().toBuffer();
  const r=await prepareProfileArtImage({kind:"avatar",bytes},empty());assert.equal(r.code,"low_information");assert.equal(r.inventoryReady,false);
});
test("an over-budget encoded output fails closed (synthetic bytes only, never saved as artwork)",async()=>{
  const raw=Buffer.alloc(1500*600*3);let state=0x437c127f;
  for(let i=0;i<raw.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;raw[i]=state&255;}
  const bytes=await sharp(raw,{raw:{width:1500,height:600,channels:3}}).png().toBuffer();
  const r=await prepareProfileArtImage({kind:"cover",bytes},empty());assert.equal(r.code,"output_too_large");assert.equal(r.inventoryReady,false);
});
test("container scan work is capped even for thousands of small chunks",async()=>{
  const png=await sharp(await fixture("avatar-01.webp")).png().toBuffer();
  const junk=Array.from({length:policy.maxContainerChunks},()=>pngChunk("zzZZ",Buffer.alloc(0)));
  const bytes=Buffer.concat([png.subarray(0,33),...junk,png.subarray(33)]);
  const r=await prepareProfileArtImage({kind:"avatar",bytes},empty());assert.equal(r.code,"invalid_container");
});
test("resizing a known illustration is not a new exclusive picture",async()=>{
  const first=await prepared(),bytes=await sharp(await fixture("avatar-01.webp")).resize(768,768).png().toBuffer();
  const r=await prepareProfileArtImage({kind:"avatar",bytes},against("original",first.image));
  assert.equal(r.ok,false,summary(r));assert.ok(["duplicate_pixels","similar_structure"].includes(r.code),summary(r));
});
test("expired monotonic processing budget gives a typed error without a ready result",async t=>{
  const bytes=await fixture("avatar-01.webp");let calls=0;
  const clock=t.mock.method(performance,"now",()=>++calls===1?0:policy.processingBudgetMs+1);
  try{const r=await prepareProfileArtImage({kind:"avatar",bytes},empty());assert.equal(r.code,"processing_timeout");assert.equal(r.inventoryReady,false);}
  finally{clock.mock.restore();}
});
test("an emitted WebP used as a new input is an exact cross-stage pixel duplicate",async()=>{
  const first=await prepared();
  const reencoded=await prepareProfileArtImage({kind:"avatar",bytes:first.image.bytes},empty());
  assert.equal(reencoded.ok,true,summary(reencoded));
  assert.equal(reencoded.image.fingerprint.canonicalPixelSHA256,first.image.fingerprint.pixelSHA256);
  assert.notEqual(reencoded.image.fingerprint.canonicalPixelSHA256,first.image.fingerprint.canonicalPixelSHA256);
  assert.notEqual(reencoded.image.fingerprint.pixelSHA256,first.image.fingerprint.pixelSHA256);
  const blocked=await prepareProfileArtImage({kind:"avatar",bytes:first.image.bytes},against("first-encoding",first.image));
  assert.equal(blocked.code,"duplicate_pixels");assert.equal(blocked.match.classification,"identical_cross_stage_pixels");
  assert.equal(blocked.match.artworkID,"first-encoding");assert.equal(blocked.inventoryReady,false);
});
test("the reverse output-to-canonical reference relationship is also exact, not heuristic",async()=>{
  const original=await fixture("avatar-01.webp"),first=await prepared();
  const reencoded=await prepareProfileArtImage({kind:"avatar",bytes:first.image.bytes},empty());
  assert.equal(reencoded.ok,true,summary(reencoded));
  assert.equal(first.image.fingerprint.pixelSHA256,reencoded.image.fingerprint.canonicalPixelSHA256);
  const blocked=await prepareProfileArtImage({kind:"avatar",bytes:original},against("later-encoding",reencoded.image));
  assert.equal(blocked.code,"duplicate_pixels");assert.equal(blocked.match.classification,"identical_cross_stage_pixels");
  assert.equal(blocked.match.artworkID,"later-encoding");assert.equal(blocked.inventoryReady,false);
});
