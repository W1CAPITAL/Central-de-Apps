import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
test('loja e PredictBot independente mostram reparo OpenCode, sem auto instalar',()=>{
 const main=read('src/main.mjs'),preload=read('src/preload.cjs');
 for(const page of ['src/store.html','src/predictbot.html']){
  assert.match(read(page),/id="oc-desktop-check"/);
  assert.match(read(page),/id="oc-desktop-repair"/);
  assert.match(read(page),/opencode-desktop-update-ui\.js/);
 }
 assert.match(main,/trustedOpenCodeEvent/);
 assert.match(main,/dialog\.showMessageBox/);
 assert.match(preload,/openCodeDesktopUpdate:/);
});
test('reparo só inicia quando usuário clica, e mostra resultado sem prometer instalação concluída',async()=>{
 const html='<!DOCTYPE html><button id="oc-desktop-check">Verificar</button><button id="oc-desktop-repair">Reparar</button><p id="oc-desktop-update-status"></p>';
 const dom=new JSDOM(html,{runScripts:'outside-only'});
 const calls=[];
 dom.window.w1Central={
  openCodeDesktopUpdate:async action=>{
   calls.push(action);
   return action==='check'?{version:'2.3.2',nativeUpdater:true}:{launched:true,version:'2.3.2'};
  },
  onOpenCodeDesktopProgress:()=>()=>{}
 };
 try{
  dom.window.eval(read('src/opencode-desktop-update-ui.js'));
  await settle();
  assert.deepEqual(calls,[]);
  dom.window.document.getElementById('oc-desktop-check').click();
  await settle();
  assert.deepEqual(calls,['check']);
  assert.match(dom.window.document.getElementById('oc-desktop-update-status').textContent,/2\.3\.2/);
  dom.window.document.getElementById('oc-desktop-repair').click();
  await settle();
  assert.deepEqual(calls,['check','repair']);
  assert.match(dom.window.document.getElementById('oc-desktop-update-status').textContent,/instalador aberto|instalador oficial/i);
 }finally{dom.window.close()}
});
