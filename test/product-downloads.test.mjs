import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProductDownloads} from '../src/product-downloads.mjs';

test('download da loja verifica bytes, recupera arquivo e recusa adulteração sem executar nada',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-download-'));
 const bytes=Buffer.alloc(1_000_000,7);
 const name='PredictBot-Setup-0.1.51-x64.exe';
 const url='https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.51/'+name;
 const releases=[{tag_name:'preview-v0.1.51',prerelease:true,assets:[{name,size:bytes.length,
  digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),browser_download_url:url}]}];
 let requests=0;
 const downloads=new ProductDownloads({folder,fetchImpl:async requested=>{
  assert.equal(requested,url);requests++;
  const response=new Response(bytes);Object.defineProperty(response,'url',{value:url});return response;
 }});
 try{
  downloads.update(releases);
  assert.equal(downloads.snapshot('predictbot').preview,true);
  await Promise.all([downloads.download('predictbot'),downloads.download('predictbot')]);
  assert.equal(requests,1);
  assert.equal(downloads.snapshot('predictbot').phase,'downloaded');
  const path=await downloads.verifiedPath('predictbot');
  writeFileSync(path,Buffer.alloc(bytes.length,8));
  await assert.rejects(()=>downloads.verifiedPath('predictbot'),/SHA-256/);
  await assert.rejects(()=>downloads.download('lexispredict'),/Nenhum instalador/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
