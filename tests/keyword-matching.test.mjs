// Executado com o test runner nativo do Node (type stripping de .ts a partir do Node 23.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesKeywords, normalizeText, renderTemplate } from "../src/server/engine/text.ts";
import { parseJsonSafe } from "../src/lib/safe-json.ts";

test("parseJsonSafe preserva IDs grandes do Instagram", () => {
  const parsed = parseJsonSafe('{"user_id": 17841400123456789, "small": 42, "id": "123"}');
  assert.equal(parsed.user_id, "17841400123456789");
  assert.equal(parsed.small, 42);
  assert.equal(parsed.id, "123");
});

test("normaliza acentos, caixa e espaços", () => {
  assert.equal(normalizeText("  Olá   QUERO  Preço "), "ola quero preco");
});

test("contains casa palavra inteira, não pedaço de palavra", () => {
  assert.equal(matchesKeywords("Eu QUERO o link!", ["quero"], "contains"), true);
  assert.equal(matchesKeywords("querosene", ["quero"], "contains"), false);
  assert.equal(matchesKeywords("qual o preço?", ["preco"], "contains"), true);
  assert.equal(matchesKeywords("me manda o link por favor", ["link por favor"], "contains"), true);
});

test("exact e starts_with", () => {
  assert.equal(matchesKeywords("Quero", ["quero"], "exact"), true);
  assert.equal(matchesKeywords("quero sim", ["quero"], "exact"), false);
  assert.equal(matchesKeywords("quero sim", ["quero"], "starts_with"), true);
  assert.equal(matchesKeywords("eu quero", ["quero"], "starts_with"), false);
});

test("any casa qualquer texto e lista vazia não casa", () => {
  assert.equal(matchesKeywords("qualquer coisa", [], "any"), true);
  assert.equal(matchesKeywords("qualquer coisa", [], "contains"), false);
});

test("keywords com caracteres especiais de regex não quebram", () => {
  assert.equal(matchesKeywords("promo c++ hoje", ["c++"], "contains"), true);
});

test("renderTemplate substitui variáveis e remove desconhecidas", () => {
  assert.equal(renderTemplate("Oi {{first_name}}, tudo bem? {{nada}}", { first_name: "Ana" }), "Oi Ana, tudo bem?");
  assert.equal(renderTemplate("{{ USERNAME }}", { username: "@ana" }), "@ana");
});
