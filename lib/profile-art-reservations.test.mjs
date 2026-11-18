import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { prepareProfileArtCommand, profileArtDatabaseFailure, PROFILE_ART_RESERVATIONS_ENABLED } from "./profile-art-reservations.ts";

const key = "00000000-0000-4000-8000-000000000001";
const art = "00000000-0000-4000-8000-000000000002";
test("reservation command identity is exclusively supplied by authenticated context", () => {
  for (const kind of ["avatar", "cover"]) {
    const input = { action: "lease", kind, artworkId: art, expectedRevision: 0, requestKey: key };
    assert.equal(prepareProfileArtCommand(null, input).status, 401);
    const command = prepareProfileArtCommand("current-account", input);
    assert.equal(command.ok, true);
    assert.equal(command.args.p_user, "current-account");
    assert.equal(command.args.p_artwork, art);
    for (const injected of ["user_id", "p_user", "userId", "accountId", "expiresAt", "mediaKey", "url"]) {
      assert.equal(prepareProfileArtCommand("current-account", { ...input, [injected]: "foreign" }).status, 400);
    }
  }
});
test("invalid, stale representation and confirmation commands are not executable", () => {
  for (const input of [null, [], {}, {action:"confirm",kind:"avatar"}, {action:"read",kind:"company"},
    ...[-1, 1.5, "0", NaN, Infinity, Number.MAX_SAFE_INTEGER+1].map(expectedRevision => ({ action:"lease",kind:"avatar",artworkId:art,requestKey:key,expectedRevision })),
    {action:"lease",kind:"avatar",artworkId:"/profile-art/v1/avatar-01.webp",requestKey:key,expectedRevision:0}]) {
    assert.equal(prepareProfileArtCommand("actor", input).status, 400);
  }
  assert.deepEqual(prepareProfileArtCommand("actor", {action:"read",kind:"cover"}), {ok:true,rpc:"profile_art_choices",args:{p_user:"actor",p_kind:"cover"}});
  assert.equal(prepareProfileArtCommand("actor", {action:"cancel",kind:"avatar",requestKey:key,expectedRevision:2}).rpc,"profile_art_cancel");
});
test("conflicts and uncertain acknowledgements never become success or leak database details", () => {
  for (const message of ["ART_BUSY","ART_REVISION","ART_EXPIRED","ART_STALE_RETRY","ART_KEY_REUSED","ART_UNAVAILABLE"]) {
    assert.deepEqual(profileArtDatabaseFailure({code:"PT409",message}),{ok:false,status:409,code:message});
  }
  assert.equal(profileArtDatabaseFailure({code:"PT409",message:"foreign private data"}).code,"ART_CONFLICT");
  for (const code of ["57014","ECONNRESET","UNKNOWN"]) assert.deepEqual(profileArtDatabaseFailure({code}),{ok:false,status:503,code:"ART_RETRY_REQUIRED"});
  assert.equal(profileArtDatabaseFailure({code:"PGRST202"}).status,503);
});
test("server adapter binds the authenticated account and can be disabled independently", async () => {
  assert.equal(PROFILE_ART_RESERVATIONS_ENABLED,true);
  const require=createRequire(import.meta.url),ts=require("typescript");
  const text=readFileSync(new URL("./profile-art-reservations-server.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let calls=0,user="account-a";
  const deps={"server-only":{},"@/lib/auth":{getCurrentUser:async()=>user?{userId:user}:null},"@/lib/db":{db:{rpc(){calls++;throw Error("Must stay disabled");}}},"@/lib/profile-art-reservations":{prepareProfileArtCommand,profileArtDatabaseFailure,PROFILE_ART_RESERVATIONS_ENABLED:false}};
  const module={exports:{}};new Function("require","module","exports",compiled)(name=>{assert.ok(Object.hasOwn(deps,name));return deps[name];},module,module.exports);
  assert.equal((await module.exports.runProfileArtReservation({action:"read",kind:"avatar"})).status,503);
  user=null;assert.equal((await module.exports.runProfileArtReservation({action:"read",kind:"avatar"})).status,401);
  user="account-b";assert.equal((await module.exports.runProfileArtReservation({action:"read",kind:"avatar",userId:"account-a"})).status,400);
  assert.equal(calls,0);
});
