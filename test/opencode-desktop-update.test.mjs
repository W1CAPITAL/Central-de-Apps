import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chooseOpenCodeDesktopRelease,downloadVerifiedOpenCodeDesktop,OPENCODE_RELEASES_API} from '../src/opencode-desktop-update.mjs';

const sha='a'.repeat(64),base='https://github.com/anomalyco/opencode/releases/download/';
function release(version,{draft=false,prerelease=false,digest='sha256:'+sha,link=base+'v'+version+'/opencode-desktop-win-x64.exe'}={}){
 return {tag_name:'v'+version,draft,prerelease,assets:[{
  name:'opencode-desktop-win-x64.exe',size:120000000,digest,browser_download_url:link
 }]};
}

test('escolhe maior release estável OpenCode, e não depende de /releases/latest defasado',()=>{
 assert.match(OPENCODE_RELEASES_API,/releases\?per_page=/);
 const found=chooseOpenCodeDesktopRelease([release('1.19.6'),release('2.3.2'),release('2.3.1')]);
 assert.equal(found.version,'2.3.2');
 assert.equal(found.url,base+'v2.3.2/opencode-desktop-win-x64.exe');
});

test('ignora previews, hashes ausentes e link/arquivo de outro fabricante',()=>{
 const bad=[release('9.0.0',{prerelease:true}),release('8.0.0',{draft:true}),
 release('7.0.0',{digest:''}),release('6.0.0',{link:'https://evil.example/installer.exe'})];
 assert.equal(chooseOpenCodeDesktopRelease([...bad,release('2.3.2')]).version,'2.3.2');
 assert.equal(chooseOpenCodeDesktopRelease(bad),null);
});

test('não aceita installers Windows de outras arquiteturas e caminhos de download maliciosos',()=>{
 const unsafe=release('2.3.2');
 unsafe.assets[0].name='opencode-desktop-win-arm64.exe';
 assert.equal(chooseOpenCodeDesktopRelease([unsafe]),null);
});

test('download rejeita hash divergente e apaga arquivo temporário',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-opencode-update-'));
 const bytes=Buffer.from('placeholder-test-binary');
 const asset={...chooseOpenCodeDesktopRelease([release('2.3.2')]),size:bytes.length,
  sha256:'f'.repeat(64)};
 try{
  await assert.rejects(()=>downloadVerifiedOpenCodeDesktop({asset,folder,fetchImpl:async()=>({
   ok:true,url:'https://release-assets.githubusercontent.com/installer.exe',
   headers:new Headers({'content-length':String(bytes.length)}),
   body:new ReadableStream({start(c){c.enqueue(bytes);c.close()}})
  })}),/SHA-256/);
  assert.equal(existsSync(join(folder,'opencode-desktop-win-x64-2.3.2.exe')),false);
 }finally{rmSync(folder,{force:true,recursive:true});}
});

test('download verificado respeita hash, tamanho e cache, sem acessar o instalador novamente',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-opencode-update-'));
 const bytes=Buffer.from('verified-open-code-executable');
 const hash=createHash('sha256').update(bytes).digest('hex');
 const asset={...chooseOpenCodeDesktopRelease([release('2.3.2')]),size:bytes.length,sha256:hash};
 let fetched=0;
 const fetchImpl=async()=>{fetched++;return {
  ok:true,url:'https://release-assets.githubusercontent.com/installer.exe',
  headers:new Headers({'content-length':String(bytes.length)}),
  body:new ReadableStream({start(c){c.enqueue(bytes);c.close()}})
 };};
 try{
  const path=await downloadVerifiedOpenCodeDesktop({asset,folder,fetchImpl});
  assert.deepEqual(readFileSync(path),bytes);
  assert.equal(statSync(path).size,bytes.length);
  await downloadVerifiedOpenCodeDesktop({asset,folder,fetchImpl});
  assert.equal(fetched,1);
 }finally{rmSync(folder,{force:true,recursive:true});}
});

test('reparo do OpenCode exige confirmação; nunca instala em segundo plano',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.match(main,/central:opencode-desktop-update/);
 assert.match(main,/downloadVerifiedOpenCodeDesktop/);
 assert.match(main,/dialog\.showMessageBox/);
 assert.match(main,/shell\.openPath/);
 assert.doesNotMatch(main,/setInterval\([^)]*opencode-desktop-update/);
});
