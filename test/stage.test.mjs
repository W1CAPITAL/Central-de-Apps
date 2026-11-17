import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stageNext} from '../scripts/stage-next.mjs';

test('não aceita pacote Next incompleto',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-stage-'));
 try{
  mkdirSync(join(folder,'.next','standalone'),{recursive:true});
  writeFileSync(join(folder,'.next','standalone','server.js'),'');
  assert.throws(()=>stageNext(folder,'lexispredict'),/incompleto/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
test('não permite staging de aplicativo fora do catálogo',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-stage-'));
 try{assert.throws(()=>stageNext(folder,'../../windows'),/não autorizado/)}
 finally{rmSync(folder,{recursive:true,force:true})}
});
