import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PredictBotLibrary} from '../src/predictbot-library.mjs';

test('biblioteca importa texto, preserva o original e gera trecho para a IA local',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pb-lib-'));
 try{
  const sample=join(root,'notes.txt');writeFileSync(sample,'Este é um arquivo de teste seguro.');
  const library=new PredictBotLibrary({directory:join(root,'library')});
  const saved=(await library.add([sample]))[0];
  assert.equal(saved.name,'notes.txt');
  assert.equal(saved.supportedByLocalModel,true);
  const rows=await library.list();
  assert.equal(rows.length,1);
  assert.equal((await library.promptText([saved.id])).includes('arquivo de teste'),true);
  assert.equal((await library.remove(saved.id)).removed,true);
  assert.equal((await library.list()).length,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('PDF, ZIP, imagem, audio e video podem ser guardados mas não são falsamente interpretados pelo Qwen texto',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pb-media-'));
 try{
  const files=['a.pdf','b.zip','c.png','d.mp3','e.mp4'].map(n=>{const p=join(root,n);writeFileSync(p,'conteúdo fictício');return p;});
  const lib=new PredictBotLibrary({directory:join(root,'library')});
  const items=await lib.add(files);
  assert.equal(items.length,5);
  assert.ok(items.every(x=>!x.supportedByLocalModel));
  await assert.rejects(()=>lib.promptText([items[0].id]),/não consegue interpretar/i);
  await assert.rejects(()=>lib.promptText(['../../../outro']),/arquivo|seleção/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('biblioteca bloqueia executáveis e atalhos sem copiar',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pb-danger-'));
 try{
  const file=join(root,'evil.exe');writeFileSync(file,'no');
  const lib=new PredictBotLibrary({directory:join(root,'library')});
  await assert.rejects(()=>lib.add([file]),/tipo|permitido/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});
