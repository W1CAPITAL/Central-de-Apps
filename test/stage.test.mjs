import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,symlinkSync,lstatSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stageNext} from '../scripts/stage-next.mjs';

test('não aceita pacote Next incompleto',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-stage-'));
 try{
  mkdirSync(join(folder,'.next','standalone'),{recursive:true});
  writeFileSync(join(folder,'.next','standalone','server.js'),'');
  assert.throws(()=>stageNext(folder,'lexispredict',{productsRoot:join(folder,'output')}),/incompleto/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
test('não permite staging de aplicativo fora do catálogo',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-stage-'));
 try{assert.throws(()=>stageNext(folder,'../../windows'),/não autorizado/)}
 finally{rmSync(folder,{recursive:true,force:true})}
});

test('standalone aninhado continua portátil após remover a origem pnpm',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-stage-pnpm-'));
 const output=mkdtempSync(join(tmpdir(),'w1-stage-output-'));
 let target;
 try{
  const standalone=join(folder,'.next','standalone');
  const app=join(standalone,'apps','web');
  const next=join(standalone,'node_modules','.pnpm','next@15','node_modules','next');
  const styled=join(standalone,'node_modules','.pnpm','styled-jsx@5','node_modules','styled-jsx');
  mkdirSync(join(app,'.next'),{recursive:true});
  mkdirSync(join(next,'dist','server','lib'),{recursive:true});
  mkdirSync(styled,{recursive:true});
  writeFileSync(join(app,'server.js'),'// synthetic standalone');
  writeFileSync(join(app,'.next','BUILD_ID'),'synthetic-build');
  writeFileSync(join(next,'package.json'),'{"name":"next","version":"15.0.0","dependencies":{"styled-jsx":"5"}}');
  writeFileSync(join(styled,'package.json'),'{"name":"styled-jsx"}');
  writeFileSync(join(next,'dist','server','lib','start-server.js'),'export const startServer = () => {};');
  writeFileSync(join(next,'.env.local'),'SYNTHETIC=private');
  symlinkSync(next,join(standalone,'node_modules','next'),'junction');
  symlinkSync(styled,join(standalone,'node_modules','.pnpm','next@15','node_modules','styled-jsx'),'junction');
  ({target}=stageNext(folder,'lexispredict',{productsRoot:output}));
  rmSync(folder,{recursive:true,force:true});
  const copied=join(target,'node_modules','next');
  assert.equal(lstatSync(copied).isSymbolicLink(),false);
  assert.equal(JSON.parse(readFileSync(join(copied,'package.json'),'utf8')).name,'next');
  assert.equal(existsSync(join(copied,'dist','server','lib','start-server.js')),true);
  assert.equal(existsSync(join(target,'node_modules','styled-jsx','package.json')),true);
  assert.equal(existsSync(join(copied,'node_modules','styled-jsx','package.json')),true);
  assert.equal(existsSync(join(copied,'.env.local')),false);
 }finally{
  rmSync(folder,{recursive:true,force:true});
  rmSync(output,{recursive:true,force:true});
 }
});
