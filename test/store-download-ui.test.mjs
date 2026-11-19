import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('loja baixa o produto escolhido e mostra progresso sem executar HTML da release',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../src/store.html',import.meta.url),'utf8'),{runScripts:'outside-only'});
 const calls=[];let update;
 const state={apps:[{id:'predictbot',name:'PredictBot',status:{phase:'bundled'},download:{version:'0.1.51',preview:true,phase:'available'}}],release:{}};
 dom.window.w1Central={onState:callback=>{update=callback},getState:async()=>state,
  downloadProduct:async id=>{calls.push(id)},setAutomaticUpdates:async()=>{},showDownload:async()=>{}};
 try{
  dom.window.eval(readFileSync(new URL('../src/store.js',import.meta.url),'utf8'));
  await new Promise(r=>setTimeout(r,0));
  const button=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Baixar PredictBot para Windows');
  assert.ok(button);button.click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls,['predictbot']);
  state.apps[0].download={version:'0.1.51',phase:'downloading',percent:37,error:'<img src=x onerror=alert(1)>'};update(state);
  const progress=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Baixando 37%');
  assert.equal(progress.disabled,true);
  assert.equal(dom.window.document.querySelector('.card-error img'),null);
  state.apps=['infinitum','lexispredict','predictbot'].map(id=>({id,name:id}));
  update(state);
  for(const id of state.apps.map(app=>app.id)){
   const src=dom.window.document.querySelector('.product-card.'+id+' img.app-mark').getAttribute('src');
   assert.equal(src,'./brand/'+id+'.png');
   const png=readFileSync(new URL('../src/'+src,import.meta.url));
   assert.equal(png.readUInt32BE(0),0x89504e47);
  }
 }finally{dom.window.close()}
});
