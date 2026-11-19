import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture({installed}){
 const dom=new JSDOM(read('src/store.html'),{runScripts:'outside-only'});
 const calls=[];
 const state={apps:[{id:'lexispredict',name:'LexisPredict',status:{phase:'bundled'},
  download:{version:'0.1.212',phase:'available'},installation:{installed,phase:installed?'installed':'missing',version:installed?'0.1.211':null}}],release:{}};
 dom.window.w1Central={onState:()=>{},getState:async()=>state,setAutomaticUpdates:async()=>{},
  launch:async id=>calls.push(['bundled',id]),
  openInstalledProduct:async id=>calls.push(['installed',id]),
  installProduct:async id=>{calls.push(['install',id]);return {installed:true,opened:true}}
 };
 dom.window.eval(read('src/store.js'));
 return {dom,calls};
}
test('Abrir inicia o EXE independente quando o produto foi instalado',async()=>{
 const {dom,calls}=fixture({installed:true});
 try{
  await tick();
  const button=dom.window.document.querySelector('.product-card.lexispredict button.launch-btn');
  assert.equal(button.textContent,'Abrir LexisPredict');
  button.click();await tick();
  assert.deepEqual(calls,[['installed','lexispredict']]);
  assert.equal(button.textContent,'Abrir LexisPredict');
  assert.ok([...dom.window.document.querySelectorAll('.product-card.lexispredict button')].some(x=>x.textContent.includes('Instalar ou atualizar e abrir')));
 }finally{dom.window.close()}
});
test('Sem EXE independente, Abrir usa a cópia local da Central',async()=>{
 const {dom,calls}=fixture({installed:false});
 try{
  await tick();
  const button=dom.window.document.querySelector('.product-card.lexispredict button.launch-btn');
  assert.equal(button.textContent,'Abrir na Central · LexisPredict');
  button.click();await tick();
  assert.deepEqual(calls,[['bundled','lexispredict']]);
  const oneClick=[...dom.window.document.querySelectorAll('.product-card.lexispredict button')].find(x=>x.textContent.startsWith('Instalar ou atualizar e abrir'));
  assert.ok(oneClick);oneClick.click();await tick();
  assert.deepEqual(calls,[['bundled','lexispredict'],['install','lexispredict']]);
 }finally{dom.window.close()}
});
