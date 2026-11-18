import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {downloadVerifiedAsset} from '../src/local-ai-manager.mjs';

const payload=Buffer.from('W1 local AI verified payload');
const digest=createHash('sha256').update(payload).digest('hex');
const asset={url:'https://github.com/ggml-org/llama.cpp/releases/download/test/runtime.zip',sha256:digest,maxBytes:1024};

function response({url='https://release-assets.githubusercontent.com/runtime.zip',bytes=payload,status=200}={}){
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(bytes));controller.close();}});
 return {ok:status===200,status,url,headers:new Headers({'content-length':String(bytes.length)}),body};
}

test('downloadVerifiedAsset grava somente conteúdo com SHA-256 correto',async()=>{
 const root=await mkdtemp(join(tmpdir(),'w1-local-ai-'));
 try{
  const destination=join(root,'runtime.zip');
  const result=await downloadVerifiedAsset({asset,destination,assetType:'engine',fetchImpl:async()=>response()});
  assert.equal(result.sha256,digest);
  assert.deepEqual(await readFile(destination),payload);
  assert.equal((await stat(destination)).size,payload.length);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('downloadVerifiedAsset rejeita hash divergente e apaga o arquivo parcial',async()=>{
 const root=await mkdtemp(join(tmpdir(),'w1-local-ai-'));
 try{
  const destination=join(root,'bad.zip');
  await assert.rejects(()=>downloadVerifiedAsset({asset:{...asset,sha256:'0'.repeat(64)},destination,assetType:'engine',fetchImpl:async()=>response()}),/SHA-256/);
  await assert.rejects(()=>stat(destination),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('downloadVerifiedAsset rejeita redirecionamento para host desconhecido',async()=>{
 const root=await mkdtemp(join(tmpdir(),'w1-local-ai-'));
 try{
  const destination=join(root,'evil.zip');
  await assert.rejects(()=>downloadVerifiedAsset({asset,destination,assetType:'engine',fetchImpl:async()=>response({url:'https://evil.example/payload'})}),/Origem|autorizada/);
  await assert.rejects(()=>stat(destination),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('downloadVerifiedAsset limita o tamanho recebido mesmo sem Content-Length',async()=>{
 const root=await mkdtemp(join(tmpdir(),'w1-local-ai-'));
 try{
  const destination=join(root,'large.zip');
  const large=Buffer.alloc(2048,7);
  await assert.rejects(()=>downloadVerifiedAsset({asset:{...asset,maxBytes:100},destination,assetType:'engine',fetchImpl:async()=>response({bytes:large})}),/limite|tamanho/i);
  await assert.rejects(()=>stat(destination),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
