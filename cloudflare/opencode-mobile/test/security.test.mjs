import test from "node:test";
import assert from "node:assert/strict";
import { authorized, promptFromBody } from "../src/security.mjs";

const secret = "long-random-secret-at-least-24-characters";
test("rejects requests without a configured server secret", () => {
  assert.equal(authorized("Bearer " + secret, ""), false);
  assert.equal(authorized("Bearer " + secret, "short"), false);
});
test("requires exact bearer secret, never accepts prefix or wrong credential", () => {
  assert.equal(authorized(null, secret), false);
  assert.equal(authorized(secret, secret), false);
  assert.equal(authorized("Bearer " + secret.slice(0, -1), secret), false);
  assert.equal(authorized("Bearer " + secret + "x", secret), false);
  assert.equal(authorized("Bearer " + secret, secret), true);
});
test("validates chat payload before running the agent", () => {
  assert.equal(promptFromBody('{"prompt":"  Verifique os testes  "}'), "Verifique os testes");
  assert.throws(() => promptFromBody('{"prompt":""}'));
  assert.throws(() => promptFromBody('{"prompt":123}'));
  assert.throws(() => promptFromBody('not-json'));
  assert.throws(() => promptFromBody(JSON.stringify({prompt:"x".repeat(12001)})));
  assert.throws(() => promptFromBody("x".repeat(16001)));
});
