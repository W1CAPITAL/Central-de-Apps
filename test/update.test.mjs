import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
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
 assert.match(asset.url,/github\.com\/W1CAPITAL\/Central-de-Apps\/releases\/download/);
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
test('instalador exige verificação Authenticode em duas etapas e consentimento humano',()=>{
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.match(main,/central:download-update/);
 assert.match(main,/central:install-update/);
 assert.match(main,/verifyWindowsSignature/);
 assert.match(main,/showMessageBox/);
 assert.match(main,/Baixar em segundo plano/);
 const script=readFileSync(new URL('../src/verify-signature.ps1',import.meta.url),'utf8');
 assert.match(script,/Get-AuthenticodeSignature/);
 assert.match(script,/Valid/);
 assert.match(script,/W1 Capital/);
 assert.doesNotMatch(main,/ExecutionPolicy.*Bypass/);
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
