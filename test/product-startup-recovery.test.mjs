import test from 'node:test';
import assert from 'node:assert/strict';
import {singleFlight,loadProductWhenReady,isProductScreenReady} from '../src/product-startup.mjs';

test('5 cliques simultâneos iniciam um único processo e recebem a mesma janela',async()=>{
 const pending=new Map();
 let starts=0,release;
 const gate=new Promise(resolve=>{release=resolve});
 const tasks=Array.from({length:5},()=>singleFlight(pending,'lexispredict',async()=>{
  starts++;await gate;return {loaded:true};
 }));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(starts,1);
 release();
 const results=await Promise.all(tasks);
 assert.equal(starts,1);
 assert.equal(results.length,5);
 assert.ok(results.every(result=>result===results[0]));
 assert.equal(pending.size,0);
});

test('falha anterior não bloqueia nova tentativa, mas também não cria inícios duplicados',async()=>{
 const pending=new Map();
 let attempts=0;
 const execute=()=>singleFlight(pending,'infinitum',()=>{attempts++;throw Error('porta temporariamente indisponível')});
 await assert.rejects(execute(),/porta temporariamente/);
 await assert.rejects(execute(),/porta temporariamente/);
 assert.equal(attempts,2);
});

test('tela preta no primeiro carregamento é recuperada sem novos cliques do usuário',async()=>{
 let navigations=0,inspections=0,retries=0;
 const result=await loadProductWhenReady({
  navigate:async()=>{navigations++;inspections=0;},
  inspect:async()=>{
   inspections++;
   if(navigations===1)return {ready:true,visibleCharacters:0,fatal:false};
   return {ready:true,visibleCharacters:62,fatal:false};
  },
  wait:async()=>{},onRetry:()=>{retries++},
  attempts:3,checksPerAttempt:2
 });
 assert.equal(result.ready,true);
 assert.equal(navigations,2);
 assert.equal(retries,1);
});

test('navegação falha e depois funciona, sem lançar janela com erro de IP',async()=>{
 let navigations=0;
 const result=await loadProductWhenReady({
  navigate:async()=>{if(++navigations===1)throw Error('ERR_CONNECTION_RESET');},
  inspect:async()=>({ready:true,visibleCharacters:80,fatal:false}),
  wait:async()=>{},
  attempts:3,checksPerAttempt:2
 });
 assert.equal(result.visibleCharacters,80);
 assert.equal(navigations,2);
});

test('erro de renderização e página vazia nunca são considerados aplicativos prontos',async()=>{
 assert.equal(isProductScreenReady({ready:true,visibleCharacters:0,fatal:false}),false);
 assert.equal(isProductScreenReady({ready:false,visibleCharacters:150,fatal:false}),false);
 assert.equal(isProductScreenReady({ready:true,visibleCharacters:150,fatal:true}),false);
 assert.equal(isProductScreenReady({ready:true,visibleCharacters:50,fatal:false}),true);
 let count=0;
 await assert.rejects(loadProductWhenReady({
  navigate:async()=>{count++},
  inspect:async()=>({ready:true,visibleCharacters:0,fatal:false}),
  wait:async()=>{},attempts:3,checksPerAttempt:2
 }),/não conseguiu carregar/i);
 assert.equal(count,3);
});
