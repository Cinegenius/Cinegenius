import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../components/PersonalSettings.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function nodes(value, predicate, result = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, predicate, result));
  else if (value && typeof value === "object" && value.props) {
    if (predicate(value)) result.push(value);
    nodes(value.props.children, predicate, result);
  }
  return result;
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object") return text(value.props?.children);
  return typeof value === "string" ? value : "";
}

function fixture({ actor = "owner", accountId = "owner", section = "", verification = React.createElement("span", {}, "verification-fixture"), dangerZone = React.createElement("button", {}, "delete-fixture") } = {}) {
  let open = section || null, opened = 0, tree;
  const icon = () => React.createElement("svg");
  const mocks = {
    react: { ...React, useEffect() {}, useId: () => "settings-fixture", useState: () => [open, value => { open = typeof value === "function" ? value(open) : value; }] },
    "next-intl": { useTranslations: () => key => key },
    "next/navigation": { useSearchParams: () => new URLSearchParams({ section }) },
    "next/link": { default: props => React.createElement("a", props) },
    "@clerk/nextjs": {
      useAuth: () => ({ isLoaded: true, isSignedIn: !!actor, userId: actor }),
      useUser: () => ({ isLoaded: true, user: actor ? { id: actor, primaryEmailAddress: { emailAddress: "own@example.invalid" } } : null }),
      useClerk: () => ({ openUserProfile() { opened += 1; } }),
    },
    "lucide-react": { Bell: icon, ChevronDown: icon, ChevronRight: icon, ShieldCheck: icon, Trash2: icon, Wallet: icon },
    "@/components/PrivacySettings": { default: () => null },
    "@/components/NotificationPreferences": { default: () => null },
    "@/components/app/NativePushSettings": { default: () => null },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(name => {
    const value = mocks[name] ?? require(name);
    return value && typeof value === "object" && "default" in value ? { __esModule: true, ...value } : value;
  }, loaded, loaded.exports);
  function render() { tree = loaded.exports.default({ accountId, verification, dangerZone }); }
  render();
  return { render, get tree() { return tree; }, get opened() { return opened; } };
}

test("account security delegates only an explicit click to Clerk's real account editor", () => {
  const f = fixture({ section: "security" });
  assert.equal(f.opened, 0);
  const button = nodes(f.tree, node => node.type === "button" && text(node.props.children) === "nav.accountSettings")[0];
  assert.ok(button); button.props.onClick();
  assert.equal(f.opened, 1);
});

test("stale account props never reveal the previous account's details or credential controls", () => {
  for (const actor of ["other", null]) {
    const f = fixture({ actor, section: "security" });
    assert.equal(nodes(f.tree, node => node.type === "button").length, 0);
    assert.doesNotMatch(text(f.tree), /own@example\.invalid/);
  }
});

test("deletion stays collapsed and old verification upload and invoice destinations remain available", () => {
  const f = fixture();
  assert.equal(nodes(f.tree, node => text(node.props.children) === "delete-fixture").length, 0);
  assert.equal(nodes(f.tree, node => node.props.href === "/invoices").length, 1);
  const dangerButton = nodes(f.tree, node => node.type === "button" && text(node.props.children) === "Ui.text_73fc53cbf7c175")[0];
  dangerButton.props.onClick(); f.render();
  assert.equal(nodes(f.tree, node => node.type === "button" && node.props.children === "delete-fixture").length, 1);
  const verification = fixture({ section: "verification" });
  assert.equal(nodes(verification.tree, node => node.props.href === "/profile?tab=verification").length, 1);
});
