import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProductRelease,selectProductRelease} from '../src/distribution.mjs';

function release(product='lexispredict',preview=false,version='0.1.51'){
 const prefix=product==='lexispredict'?'LexisPredict':'PredictBot';
 const tag=(preview?'preview-v':'v')+version;
 const name=prefix+'-Setup-'+version+'-x64.exe';
 return {tag_name:tag,prerelease:preview,draft:false,assets:[{name,size:60_000_000,
  digest:'sha256:'+'a'.repeat(64),browser_download_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/'+tag+'/'+name}]};
}
test('cada produto recebe seu EXE e não aceita instalador de outro aplicativo',()=>{
 for(const id of ['lexispredict','predictbot']){
  const asset=validateProductRelease(release(id),id);
  assert.equal(asset.product,id);
  assert.match(asset.name,new RegExp(id==='predictbot'?'^PredictBot-':'^LexisPredict-'));
 }
 assert.throws(()=>validateProductRelease(release('predictbot'),'lexispredict'));
 assert.throws(()=>validateProductRelease(release(),'../../Windows'));
});
test('pré-release é download manual; somente estável entra no atualizador',()=>{
 const preview=release('lexispredict',true,'0.1.52');
 assert.throws(()=>validateProductRelease(preview,'lexispredict'),/teste/);
 assert.equal(validateProductRelease(preview,'lexispredict',{manual:true}).preview,true);
 assert.equal(selectProductRelease([preview,release()],'lexispredict').version,'0.1.51');
 assert.equal(selectProductRelease([preview,release()],'lexispredict',{manual:true}).version,'0.1.52');
});
test('metadados adulterados, sem hash, rascunhos e tags inconsistentes falham fechados',()=>{
 for(const change of [{browser_download_url:'https://evil.test/setup.exe'},{digest:undefined},{size:4}]){
  const item=release();Object.assign(item.assets[0],change);
  assert.throws(()=>validateProductRelease(item,'lexispredict'));
 }
 assert.throws(()=>validateProductRelease({...release(),draft:true},'lexispredict',{manual:true}));
 assert.throws(()=>validateProductRelease({...release(),tag_name:'preview-v0.1.51'},'lexispredict'));
});


test('INFINITUM tem instalador próprio versionado e isolado das demais versões',async()=>{
 const {productSpec}=await import('../src/distribution.mjs');
 assert.equal(productSpec('infinitum').appId,'br.com.w1capital.infinitum');
 const asset=validateProductRelease({
  tag_name:'preview-v0.1.53',prerelease:true,draft:false,
  assets:[{name:'INFINITUM-Setup-0.1.53-x64.exe',size:60_000_000,
   digest:'sha256:'+'b'.repeat(64),
   browser_download_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.53/INFINITUM-Setup-0.1.53-x64.exe'}]
 },'infinitum',{manual:true});
 assert.equal(asset.product,'infinitum');
 assert.equal(asset.preview,true);
 assert.equal(asset.version,'0.1.53');
 assert.throws(()=>validateProductRelease(release('lexispredict'),'infinitum'));
});
