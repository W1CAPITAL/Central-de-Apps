import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reserveStablePort} from '../src/runtime-policy.mjs';

test('porta por aplicativo é persistida para conservar login e cache local',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'w1-central-test-'));
 try{
  const first=await reserveStablePort(dir,'lexispredict');
  const second=await reserveStablePort(dir,'lexispredict');
  const other=await reserveStablePort(dir,'infinitum');
  assert.equal(first,second);
  assert.notEqual(first,other);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('porta local já ocupada falha fechada, sem trocar origem de autenticação',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'w1-central-test-'));
 const server=createServer();
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  writeFileSync(join(dir,'lexispredict-port.json'),JSON.stringify({port:address.port}));
  await assert.rejects(()=>reserveStablePort(dir,'lexispredict'),/ocupad|reservad/i);
 }finally{await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true})}
});

test('redirecionamento localhost do Next preserva a origem privada e a porta do aplicativo',async()=>{
 const {canonicalProductUrl}=await import('../src/runtime-policy.mjs');
 assert.equal(canonicalProductUrl('http://localhost:51234/login?next=%2Fprocessos',51234),
  'http://127.0.0.1:51234/login?next=%2Fprocessos');
 assert.equal(canonicalProductUrl('http://127.0.0.1:51234/login',51234),'http://127.0.0.1:51234/login');
 for(const url of ['http://localhost:51235/login','http://localhost.evil.test:51234/login',
  'http://user:pass@localhost:51234/login','https://localhost:51234/login','http://[::1]:51234/login'])
  assert.equal(canonicalProductUrl(url,51234),null,url);
 assert.equal(canonicalProductUrl('http://localhost:51234/login',0),null);
});
