import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProductDownloads} from '../src/product-downloads.mjs';
import {downloadVerifiedRelease} from '../src/update-security.mjs';
import {validateProductRelease} from '../src/distribution.mjs';

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
  const preview=validateProductRelease(releases[0],'predictbot',{manual:true});
  assert.equal(preview.preview,true,'a preview verificada no GitHub entra no catálogo automático');
  assert.equal(downloads.snapshot('predictbot').preview,true);
  await Promise.all([downloads.download('predictbot'),downloads.download('predictbot')]);
  assert.equal(requests,1);
  assert.equal(downloads.snapshot('predictbot').phase,'downloaded');
  const path=await downloads.verifiedPath('predictbot');
  if(process.platform==='win32')assert.match(readFileSync(path+':Zone.Identifier','utf8'),/ZoneId=3/);
  writeFileSync(path,Buffer.alloc(bytes.length,8));
  await assert.rejects(()=>downloads.verifiedPath('predictbot'),/SHA-256/);
  await assert.rejects(()=>downloads.download('lexispredict'),/Nenhum instalador/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});


test('catálogo unificado permite baixar também o INFINITUM sem disparar instalação',()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-infinitum-'));
 try{
  const name='INFINITUM-Setup-0.1.53-x64.exe';
  const url='https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.53/'+name;
  const downloads=new ProductDownloads({folder});
  downloads.update([{tag_name:'preview-v0.1.53',prerelease:true,draft:false,assets:[{
   name,size:60_000_000,digest:'sha256:'+'a'.repeat(64),browser_download_url:url
  }]}]);
  assert.equal(downloads.snapshot('infinitum').version,'0.1.53');
  assert.equal(downloads.snapshot('infinitum').preview,true);
  assert.equal(downloads.snapshot('infinitum').phase,'available');
  assert.equal(downloads.snapshot('predictbot').phase,'unavailable');
 }finally{rmSync(folder,{recursive:true,force:true})}
});

test('reabrir a Central reutiliza instalador de produto já validado sem baixar tudo novamente',async()=>{
 const root=mkdtempSync(join(tmpdir(),'w1-cache-reopen-'));
 const bytes=Buffer.alloc(1_000_000,31),version='0.1.212';
 const name='INFINITUM-Setup-'+version+'-x64.exe';
 const url='https://github.com/W1CAPITAL/Central-de-Apps/releases/download/v'+version+'/'+name;
 const releases=[{tag_name:'v'+version,prerelease:false,draft:false,assets:[{
  name,size:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),browser_download_url:url
 }]}];
 let calls=0;
 const fetchImpl=async()=>{
  calls++;
  const response=new Response(bytes);Object.defineProperty(response,'url',{value:url});return response;
 };
 try{
  const first=new ProductDownloads({folder:root,fetchImpl});
  first.update(releases);await first.download('infinitum');
  const second=new ProductDownloads({folder:root,fetchImpl});
  second.update(releases);await second.download('infinitum');
  assert.equal(calls,1,'um instalador validado não deve baixar de novo após reiniciar');
  assert.equal(second.snapshot('infinitum').phase,'downloaded');
 }finally{rmSync(root,{recursive:true,force:true})}
});
