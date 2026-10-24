import test from "node:test";
import assert from "node:assert/strict";
import { isProjectId, PROJECT_RECORD_COLUMNS, projectRecordWithDetails, toPublicProjectRecord } from "./project-record.ts";

test("project details are read from metadata without requiring optional database columns", () => {
  const project = projectRecordWithDetails({
    id: "a1b70b83-5950-4dbd-9198-506044f8423b",
    title: "Testfilm",
    metadata: { project_details: { synopsis: "Kurzinhalt", genres: ["Drama"], verified: true } },
  });

  assert.equal(project.synopsis, "Kurzinhalt");
  assert.deepEqual(project.genres, ["Drama"]);
  assert.equal(project.verified, true);
  assert.equal(PROJECT_RECORD_COLUMNS.includes("synopsis"), false);
  assert.equal(PROJECT_RECORD_COLUMNS.includes("metadata"), true);
});

test("legacy root metadata and single genre remain readable", () => {
  const project = projectRecordWithDetails({
    metadata: { genre: "Dokumentation", logline: "Älterer Eintrag" },
  });

  assert.equal(project.logline, "Älterer Eintrag");
  assert.deepEqual(project.genres, ["Dokumentation"]);
});

test("public project records omit creator IDs and internal metadata", () => {
  assert.deepEqual(toPublicProjectRecord({
    id: "project-1",
    title: "Öffentlich",
    created_by: "clerk-private-id",
    metadata: { draft_id: "private-draft-id", project_details: { synopsis: "Kurzinhalt" } },
  }), {
    id: "project-1",
    title: "Öffentlich",
    synopsis: "Kurzinhalt",
  });
});

test("project routes accept UUIDs and reject malformed IDs before querying", () => {
  assert.equal(isProjectId("a1b70b83-5950-4dbd-9198-506044f8423b"), true);
  assert.equal(isProjectId("not-a-project"), false);
});
