import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateReleaseAsset,verifyFileDigest} from '../src/update-security.mjs';

const current={
 tag_name:'v0.1.44',
 html_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/tag/v0.1.44',
 assets:[{
  name:'W1-Central-de-Apps-Setup-0.1.44-x64.exe',
  browser_download_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/v0.1.44/W1-Central-de-Apps-Setup-0.1.44-x64.exe',
  size:155000000,
  digest:'sha256:'+'a'.repeat(64)
 }]
};
test('somente EXE oficial da Central com digest SHA-256 permite download',()=>{
 const asset=validateReleaseAsset(current);
 assert.equal(asset.version,'0.1.44');
 assert.equal(asset.sha256,'a'.repeat(64));
 assert.ok(asset.url.includes('github.com/W1CAPITAL/Central-de-Apps/releases/download'));
});
test('rejeita download de origem externa, caminho estranho e digests ausentes',()=>{
 const asset=current.assets[0];
 for(const patch of [
  {browser_download_url:'https://evil.example/setup.exe'},
  {name:'malware.exe'},
  {size:4},
  {digest:undefined},
  {digest:'sha256:'+'x'.repeat(64)}
 ]){
  const release={...current,assets:[{...asset,...patch}]};
  assert.throws(()=>validateReleaseAsset(release));
 }
});
test('atualização não depende de Authenticode e usa o instalador de instalação no mesmo diretório',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.ok(main.includes('downloadVerifiedRelease'));
 assert.ok(main.includes('createInPlaceUpdatePlan'));
 assert.ok(main.includes('windowsVerbatimArguments:true'));
 assert.ok(main.includes('verifyFileDigest(downloadedInstaller,verifiedAsset)'));
 assert.ok(!main.includes('verifyWindowsSignature'));
});
test('instalador adulterado depois do download é recusado antes do reinício',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-update-'));
 const file=join(folder,'signed-installer.exe');
 try{
  const payload=Buffer.from('fake-test-installer');
  writeFileSync(file,payload);
  const asset={size:payload.length,sha256:createHash('sha256').update(payload).digest('hex')};
  assert.equal(await verifyFileDigest(file,asset),true);
  writeFileSync(file,Buffer.from('adulterated-payload'));
  await assert.rejects(()=>verifyFileDigest(file,asset),/SHA-256/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
test('pré-release e rascunho nunca entram no atualizador oficial',()=>{
 assert.throws(()=>validateReleaseAsset({...current,prerelease:true}),/canal oficial/);
 assert.throws(()=>validateReleaseAsset({...current,draft:true}),/canal oficial/);
});
