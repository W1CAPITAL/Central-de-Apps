import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('teste real Windows seleciona botões por produto, independentemente do texto visual',()=>{
 const script=read('scripts/verify-desktop-ui.mjs');
 assert.doesNotMatch(script,/getByRole\('button',\{name:'Abrir /);
 for(const id of ['lexispredict','infinitum','predictbot']){
  assert.match(script,new RegExp('product-card\\.'+id));
 }
});

test('botões de abrir reais aparecem sob IDs de produto fixos da loja',async()=>{
 const dom=new JSDOM(read('src/store.html'),{runScripts:'outside-only'});
 const apps=['lexispredict','infinitum','predictbot'].map(id=>({id,name:id,status:{phase:'bundled'},download:{phase:'unavailable'}}));
 dom.window.w1Central={getState:async()=>({apps,release:{}}),onState:()=>{},setAutomaticUpdates:async()=>{}};
 try{
  dom.window.eval(read('src/store.js'));
  await new Promise(resolve=>setTimeout(resolve,0));
  for(const id of ['lexispredict','infinitum','predictbot']){
   const button=dom.window.document.querySelector('.product-card.'+id+' button.launch-btn');
   assert.ok(button,'botão de iniciar '+id+' não encontrado');
   assert.equal(button.disabled,false);
  }
 }finally{dom.window.close()}
});
