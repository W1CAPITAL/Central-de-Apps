import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('ao interromper o download, a tela volta a permitir retomar',async()=>{
 const read=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
 const dom=new JSDOM(read('store.html'),{runScripts:'outside-only'});
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 let state={phase:'not-installed'},progress;
 dom.window.w1Central={
  onLocalAIProgress(callback){progress=callback},
  async localAI(action){
   if(action==='status')return state;
   progress({phase:'downloading-model',percent:65});
   state={phase:'error',supported:true,message:'Download interrompido.'};
   throw Error("Error invoking remote method 'central:local-ai': TypeError: terminated");
  }
 };
 try{
  dom.window.eval(read('local-ai-ui.js'));
  await tick();
  const get=id=>dom.window.document.getElementById(id);
  get('local-ai-prepare').click();
  await tick();
  assert.equal(get('local-ai-prepare').textContent,'Retomar preparação');
  assert.equal(get('local-ai-prepare').disabled,false);
  assert.equal(get('local-ai-progress').hidden,true);
  assert.equal(get('local-ai-message').textContent,state.message);
 }finally{dom.window.close()}
});
