import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('loja diferencia rede falhando de falta de release estável e expõe diagnóstico',async()=>{
 const dom=new JSDOM(read('src/store.html'),{runScripts:'outside-only'});
 let onState;
 const state={apps:[],storeVersion:'0.1.88',release:{available:false,version:null,error:null}};
 dom.window.w1Central={getState:async()=>state,onState:fn=>{onState=fn},setAutomaticUpdates:async()=>{}};
 try{
  dom.window.eval(read('src/store.js'));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(dom.window.document.getElementById('update-message').textContent,/versão estável/i);
  onState({...state,release:{available:false,error:'GitHub indisponível (HTTP 429)'}});
  assert.match(dom.window.document.getElementById('update-message').textContent,/HTTP 429/);
  onState({...state,release:{available:false,version:'0.1.89',error:null}});
  assert.match(dom.window.document.getElementById('update-message').textContent,/Nenhuma atualização disponível/);
 }finally{dom.window.close()}
});
