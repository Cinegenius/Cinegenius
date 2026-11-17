import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const profile = readFileSync(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("page.tsx", profile, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function find(node, predicate) {
  if (predicate(node)) return node;
  let result; ts.forEachChild(node, child => { result ??= find(child, predicate); }); return result;
}
function expression(text, scope) {
  const compiled = ts.transpileModule(`module.exports = (${text});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(scope), compiled)(require, loaded, loaded.exports, ...Object.values(scope));
  return loaded.exports;
}
function callback(name, scope) {
  const declaration = find(parsed, node => ts.isVariableDeclaration(node) && node.name.getText(parsed) === name);
  assert.ok(declaration, `${name} exists`); return expression(declaration.initializer.getText(parsed), scope);
}
const hydration = find(parsed, node => ts.isCallExpression(node) && node.expression.getText(parsed) === "useEffect"
  && node.arguments[0]?.getText(parsed).includes('fetch("/api/profile",') && node.arguments[0].getText(parsed).includes("setProfileExists"));
assert.ok(hydration, "actual profile hydration effect exists");

function hydrateFixture(accountId) {
  const waiting = deferred(), state = {}, requests = [];
  let active = true;
  const effectText = hydration.arguments[0].getText(parsed);
  const scope = {
    accountId, isCurrentEditor: () => active, uiText: key => key,
    fetch: (url, options) => { requests.push({ url, options }); return waiting.promise; },
    addToast: (...args) => { state.toasts ??= []; state.toasts.push(args); },
    placeInputValue: (_, text) => text, additionalCrewOccupation: () => "",
    selectedCrewOccupations: () => [], primaryOccupationForPositions: () => null,
    occupationReference: value => value, normalizeProfileTypes: value => value,
    profileCoverSettings: () => ({ brightness: 1 }),
  };
  for (const name of new Set(effectText.match(/\bset[A-Z]\w*/g))) scope[name] = value => { state[name] = value; };
  for (const name of ["availabilityConfigRef", "originalTravelReadyRef", "crewDataRef", "originalOccupationsRef", "physicalDataRef", "performanceDataRef"]) scope[name] = { current: {} };
  const cleanup = expression(effectText, scope)();
  return { state, requests, resolve: body => waiting.resolve({ ok: true, status: 200, json: async () => body }), unmount() { active = false; cleanup(); } };
}

test("the actual profile boundary replaces editor state for each loaded account and session", () => {
  const node = find(parsed, entry => ts.isFunctionDeclaration(entry) && entry.name?.text === "ProfilePage");
  let auth = { userId: "a", sessionId: "session-a", isLoaded: true, isSignedIn: true };
  let user = { user: { id: "a" }, isLoaded: true };
  const boundary = expression(node.getText(parsed).replace("export default ", ""), {
    useAuth: () => auth, useUser: () => user, useTranslations: () => key => key, ProfileEditorContent: () => null,
  });
  const first = boundary();
  assert.equal(first.props.accountId, "a");
  auth = { ...auth, userId: "b", sessionId: "session-b" };
  assert.equal(boundary().props.role, "status", "mismatched Clerk resources unmount the old editor immediately");
  user = { ...user, user: { id: "b" } };
  const second = boundary();
  assert.equal(second.props.accountId, "b"); assert.notEqual(first.key, second.key);
  auth = { ...auth, sessionId: "new-session-b" }; assert.notEqual(second.key, boundary().key);
  for (const patch of [{ isLoaded: false }, { isSignedIn: false }, { sessionId: null }]) {
    const original = auth; auth = { ...original, ...patch }; assert.equal(boundary().props.role, "status"); auth = original;
  }
});

test("unmounted account hydration is aborted and cannot populate the next editor", async () => {
  const a = hydrateFixture("a"), b = hydrateFixture("b");
  a.unmount();
  assert.equal(a.requests[0].options.signal.aborted, true);
  assert.equal(b.requests[0].options.headers["X-Profile-Account"], "b");
  b.resolve({ exists: true, profile: { user_id: "b", display_name: "B" } });
  a.resolve({ exists: true, profile: { user_id: "a", display_name: "A" } });
  await settle(); await settle();
  assert.equal(b.state.setForm.name, "B"); assert.equal(b.state.setProfileExists, true);
  assert.deepEqual(a.state, {}, "late A response causes no state, draft, or error updates");
});

test("malformed and other-account profile loads cannot become a new or recovered profile", async () => {
  for (const body of [{}, { exists: true, profile: { user_id: "other", display_name: "Other" } }, { exists: false, profile: {} }]) {
    const f = hydrateFixture("a"); f.resolve(body); await settle(); await settle();
    assert.equal(f.state.setProfileLoadError, true); assert.equal(f.state.setForm, undefined); assert.equal(f.state.setProfileExists, undefined);
  }
  const empty = hydrateFixture("a"); empty.resolve({ exists: false, profile: null }); await settle(); await settle();
  assert.equal(empty.state.setProfileExists, false); assert.equal(empty.state.setProfileLoading, false);
});

test("saving stops before sending any request when the account changes while awaiting its private draft", async () => {
  const queue = deferred(), requests = [];
  let active = true;
  const save = callback("handleSave", {
    isCurrentEditor: () => active, avatarUploading: false, coverUploading: false, profileUploading: false,
    profileLoadError: false, draftLoaded: true, form: { name: "A", city: "Berlin" }, positions: ["Camera"], currentProfileTypes: [],
    validateProfileSave: () => ({}), profileOccupationFocusError: () => null,
    originalOccupationsRef: { current: {} }, crewDataRef: { current: {} }, occupationSelections: [], primaryOccupation: null, additionalOccupation: "",
    setFieldErrors() {}, setSaving() {}, draftPausedRef: { current: false }, draftSequenceRef: { current: 0 }, draftTimerRef: { current: null },
    draftQueueRef: { current: queue.promise }, fetch: (...args) => { requests.push(args); throw new Error("unexpected write"); },
    markEditorChanged() {}, uiText: key => key, addToast() {},
  });
  const saving = save(); active = false; queue.resolve(); await saving;
  assert.deepEqual(requests, []);
});

test("an avatar compression finishing after account replacement cannot upload or notify the next account", async () => {
  const compression = deferred(), requests = [], notifications = [];
  let active = true;
  const input = { value: "photo.jpg" };
  const upload = callback("handleAvatarChange", {
    isCurrentEditor: () => active, avatarUrl: "previous", safeObjectURL: () => null,
    setAvatarPreview() {}, setAvatarUploading() {}, prepareProfileMediaFile: () => compression.promise,
    compressAvatar() {}, uiText: key => key, t: key => key,
    fetch: (...args) => { requests.push(args); throw new Error("unexpected upload"); },
    addToast: (...args) => notifications.push(args), profileExists: true,
  });
  const uploading = upload({ currentTarget: input, target: { files: [new File(["image"], "photo.jpg", { type: "image/jpeg" })] } });
  active = false; compression.resolve({ file: new File(["image"], "photo.jpg", { type: "image/jpeg" }), error: null }); await uploading;
  assert.deepEqual(requests, []); assert.deepEqual(notifications, []);
});

class TestResponse extends Response {
  static json(value, options) { return new TestResponse(JSON.stringify(value), { ...options, headers: { "Content-Type": "application/json", ...options?.headers } }); }
}
function routeHandler(path, method) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const handler = find(tree, node => ts.isFunctionDeclaration(node) && node.name?.text === method);
  const json = (body, status = 200) => TestResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  return expression(handler.getText(tree).replace("export ", ""), {
    NextResponse: TestResponse, requireAuth: async () => ({ userId: "current" }), getResponseTranslations: async () => key => key,
    json, privateNoStoreJson: json,
  });
}
for (const [path, methods] of [
  ["../app/api/profile/route.ts", ["GET", "POST", "PATCH"]],
  ["../app/api/profile/avatar/route.ts", ["POST"]],
  ["../app/api/upload/profile-media/route.ts", ["POST"]],
  ["../app/api/onboarding/route.ts", ["GET", "PUT", "DELETE"]],
]) for (const method of methods) test(`${method} ${path}: the actual handler rejects a previous editor before touching private data or uploads`, async () => {
  const result = await routeHandler(path, method)(new Request("https://example.invalid/", { headers: { "X-Profile-Account": "previous" } }));
  assert.equal(result.status, 409); assert.match(result.headers.get("Cache-Control"), /private, no-store/);
  assert.deepEqual(await result.json(), { error: "System.requestFailed" });
});
