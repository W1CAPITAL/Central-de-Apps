import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedIdentity } from "../src/security.mjs";

const env = {
  MOBILE_API_TOKEN: "legacy-secret-at-least-24-chars",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
};
const userId = "4581d2fe-c358-45f9-a1bd-f90f93dc0efc";
const jwt = "header.payload.signature-long-enough-to-be-a-real-token";

test("não expõe IA a visitante sem login", async () => {
  let requested = false;
  const fetcher = async () => {requested = true; return {ok:true};};
  assert.equal(await authenticatedIdentity(null,env,fetcher),null);
  assert.equal(await authenticatedIdentity("Bearer x",env,fetcher),null);
  assert.equal(requested,false);
});
test("login W1 validado no servidor e isolado pelo ID retornado pela autenticação", async () => {
  let requestedUrl,requestedHeaders;
  const fetcher = async (url,opts) => {
    requestedUrl=url;
    requestedHeaders=opts.headers;
    return {ok:true,json:async()=>({id:userId})};
  };
  assert.equal(await authenticatedIdentity("Bearer "+jwt,env,fetcher),"w1-user-"+userId);
  assert.equal(requestedUrl,env.SUPABASE_URL+"/auth/v1/user");
  assert.equal(requestedHeaders.apikey,env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(requestedHeaders.Authorization,"Bearer "+jwt);
});
test("recusa resposta inválida, falha de rede e JWT não reconhecido", async () => {
  assert.equal(await authenticatedIdentity("Bearer "+jwt,env,async()=>({ok:false})),null);
  assert.equal(await authenticatedIdentity("Bearer "+jwt,env,async()=>({ok:true,json:async()=>({id:"not-a-uuid"})})),null);
  assert.equal(await authenticatedIdentity("Bearer "+jwt,env,async()=>{throw Error("offline")}),null);
});
test("preserva autenticação legada somente com segredo completo do servidor", async () => {
  assert.equal(await authenticatedIdentity("Bearer "+env.MOBILE_API_TOKEN,env,async()=>{throw Error("should-not-fetch")}),"legacy-owner");
});
