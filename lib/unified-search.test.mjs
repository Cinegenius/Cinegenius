import test from "node:test";
import assert from "node:assert/strict";
import { readSearchPlan, unifiedSearchHref, searchPlanFromHref } from "./unified-search.ts";
import { wishSearchTerms, matchesWishPlaces, containsLiteral, continentCountries } from "./unified-search-matching.ts";
import { isGenieSearchHref } from "./genie-search.ts";
import { safeLinks } from "./genie-conversation.ts";
import { placeWriteFields } from "./places/catalog.ts";
import { departments } from "./departments.ts";

const place = (city, country = "", continent = "", radiusKm = 0) => ({city,country,continent,radiusKm});
const wish = (query, places = [], area = "crew", department = "") => ({area,query,department,places});
const row = (location) => ({location,...placeWriteFields(location)});

test("one wish can match either city, distinct wishes retain their own location", () => {
  const both = wish("Beleuchter", [place("Berlin"), place("Hamburg")]);
  assert.equal(matchesWishPlaces(row("Berlin, DE"), both), true);
  assert.equal(matchesWishPlaces(row("Hamburg, DE"), both), true);
  assert.equal(matchesWishPlaces(row("München, DE"), both), false);
  const model = wish("Model", [place("Berlin")]), light = wish("Beleuchter", [place("Hamburg")]);
  assert.equal(matchesWishPlaces(row("Hamburg, DE"), model), false);
  assert.equal(matchesWishPlaces(row("Berlin, DE"), light), false);
});

test("country, continent, aliases and approximate city radii remain independent", () => {
  assert.equal(matchesWishPlaces(row("Zürich, CH"), wish("", [place("", "CH")], "crew", "kostuem")), true);
  assert.equal(matchesWishPlaces(row("Berlin, DE"), wish("", [place("", "CH")], "crew", "kostuem")), false);
  assert.equal(matchesWishPlaces(row("Cape Town, ZA"), wish("Auto", [place("", "", "002")], "marketplace")), true);
  assert.equal(matchesWishPlaces(row("Berlin, DE"), wish("Auto", [place("", "", "002")], "marketplace")), false);
  assert.equal(matchesWishPlaces(row("München, Bayern, DE"), wish("Fahrer", [place("Munich")])), true);
  assert.equal(matchesWishPlaces(row("München, Bayern, DE"), wish("Fahrer", [place("München", "DE", "", 50)])), true);
  assert.equal(matchesWishPlaces(row("Berlin, DE"), wish("Fahrer", [place("München", "DE", "", 50)])), false);
  assert.equal(matchesWishPlaces(row(""), wish("Fahrer", [place("Berlin")])), false);
  assert.ok(continentCountries("002").includes("ZA"));
});

test("short occupations expand the shared catalogue without changing its identities", () => {
  const snapshot = JSON.stringify(departments);
  assert.ok(wishSearchTerms(wish("OB")).includes("Gaffer (Oberbeleuchter)"));
  assert.ok(wishSearchTerms(wish("Fahrer")).includes("Produktionsfahrer*in"));
  assert.ok(wishSearchTerms(wish("Produktionsfahrer")).includes("Produktionsfahrer*in"));
  const costumes = wishSearchTerms(wish("", [], "crew", "kostuem"));
  for (const role of departments.find(d => d.id === "kostuem").roles) assert.ok(costumes.includes(role), role);
  assert.equal(JSON.stringify(departments), snapshot);
});

test("the shared result link retains every wish and is accepted by Genie and restored history", () => {
  const plan = readSearchPlan({version:1,searches:[wish("Model",[place("Berlin")]),wish("Auto",[place("", "", "002")],"marketplace")]});
  const href = unifiedSearchHref(plan);
  assert.deepEqual(searchPlanFromHref(href),plan);
  assert.equal(isGenieSearchHref(href),true);
  assert.deepEqual(safeLinks([{href,label:"Results"}]),[{href,label:"Results"}]);
  assert.equal(searchPlanFromHref(href+"&plan=other"),null);
  assert.equal(searchPlanFromHref(href+"#https://evil.example"),null);
  assert.equal(searchPlanFromHref("https://evil.example"+href),null);
});

test("unknown fields, invalid scope and overlarge plans fail closed instead of dropping wishes", () => {
  for (const bad of [wish("Fahrer",[place("", "ZZ")]),wish("Fahrer",[place("Berlin","","002")]),wish("",[]),
    {...wish("Model"),area:"admin"},{...wish("Model"),href:"/api/admin"},wish("Model",Array.from({length:5},()=>place("Berlin"))),
    wish("Boot",[place("Berlin","","",50)],"marketplace"),wish("Model",[place("Berlin","","",-1)])]) {
    assert.equal(readSearchPlan({version:1,searches:[bad]}),null);
  }
  assert.equal(readSearchPlan({version:1,searches:Array.from({length:7},()=>wish("Model"))}),null);
  assert.equal(readSearchPlan({version:2,searches:[wish("Model")]}),null);
  const literal=containsLiteral('x\",published.eq.false,%_*');
  assert.equal(JSON.parse(literal), '%x\",published.eq.false,\\%\\_\\*%');
});
