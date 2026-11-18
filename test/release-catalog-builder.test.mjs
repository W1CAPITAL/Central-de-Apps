import test from 'node:test';
import assert from 'node:assert/strict';
import {generateReleaseCatalog} from '../scripts/create-release-catalog.mjs';

test('manifesto estável contém somente quatro EXEs com URL e hash verificáveis',()=>{
 const version='0.1.90';
 const data=generateReleaseCatalog(version,Object.fromEntries(
  ['W1-Central-de-Apps','LexisPredict','INFINITUM','PredictBot'].map(p=>[p,{
    size:150000000,
    sha256:'a'.repeat(64)
  }])
 ));
 assert.equal(data.tag_name,'v0.1.90');
 assert.equal(data.prerelease,false);
 assert.equal(data.draft,false);
 assert.equal(data.assets.length,4);
 for(const item of data.assets){
  assert.match(item.name,/^.+-Setup-0\.1\.90-x64\.exe$/);
  assert.equal(item.digest,'sha256:'+'a'.repeat(64));
  assert.equal(item.browser_download_url,
   'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/v0.1.90/'+item.name);
 }
});

test('manifesto não pode ser publicado com arquivo ausente ou hash inválido',()=>{
 const valid=Object.fromEntries(
 ['W1-Central-de-Apps','LexisPredict','INFINITUM','PredictBot'].map(p=>[p,{size:10000000,sha256:'a'.repeat(64)}]));
 for(const id of Object.keys(valid)){
  const incomplete={...valid};delete incomplete[id];
  assert.throws(()=>generateReleaseCatalog('0.1.91',incomplete),/ausente|incompleto/i);
 }
 assert.throws(()=>generateReleaseCatalog('0.1.91',{...valid,LexisPredict:{size:10000000,sha256:'x'}}),/SHA-256/);
 assert.throws(()=>generateReleaseCatalog('preview-v0.1.91',valid),/versão/i);
});
