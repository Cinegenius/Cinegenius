import test from "node:test";
import assert from "node:assert/strict";
import { projectDraftMetadata, sanitizeProjectDraftData } from "./project-drafts.ts";

test("project draft keeps only editable project fields", () => {
  assert.deepEqual(
    sanitizeProjectDraftData({ title: "Draft", created_by: "other-user", verified: true, type: "Kurzfilm" }),
    { title: "Draft", type: "Kurzfilm" },
  );
});

test("project drafts keep only bounded, non-empty crew entries", () => {
  assert.deepEqual(
    sanitizeProjectDraftData({ crew_entries: [
      { name: "  Alex  ", role: "  Kamera  ", user_id: "someone-else" },
      { name: "", role: "Ton" },
      { name: "Ohne Rolle", role: 5 },
      null,
    ] }),
    { crew_entries: [{ name: "Alex", role: "Kamera" }] },
  );
});

test("project metadata maps form links and stamps a draft only for idempotent publishing", () => {
  assert.deepEqual(
    projectDraftMetadata({ productionCompany: "Nordlicht", location: "Ulm", linked_companies: [{ id: "c1" }] }, "draft-1"),
    { production_company: "Nordlicht", location: "Ulm", linked_companies: [{ id: "c1" }], draft_id: "draft-1" },
  );
});
