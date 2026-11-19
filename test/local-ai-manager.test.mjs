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

function response({url='https://release-assets.githubusercontent.com/runtime.zip',bytes=payload,status=200,includeLength=true}={}){
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(bytes));controller.close();}});
 return {ok:status===200,status,url,headers:new Headers(includeLength?{'content-length':String(bytes.length)}:{}),body};
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
  await assert.rejects(()=>downloadVerifiedAsset({asset:{...asset,maxBytes:100},destination,assetType:'engine',fetchImpl:async()=>response({bytes:large,includeLength:false})}),/limite|tamanho/i);
  await assert.rejects(()=>stat(destination),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('downloadVerifiedAsset confere também o tamanho exato publicado no manifesto',async()=>{
 const root=await mkdtemp(join(tmpdir(),'w1-local-ai-'));
 try{
  const destination=join(root,'wrong-size.zip');
  await assert.rejects(()=>downloadVerifiedAsset({asset:{...asset,size:payload.length+1},destination,assetType:'engine',fetchImpl:async()=>response()}),/tamanho|manifesto/i);
  await assert.rejects(()=>stat(destination),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('retoma do disco após queda a 65% e verifica o arquivo completo',async()=>{
 const {createServer}=await import('node:http');
 const bytes=Buffer.alloc(100000,42),cut=65000;
 const ranges=[];
 const server=createServer((req,res)=>{
  ranges.push(req.headers.range);
  if(ranges.length===1){
   res.writeHead(200,{'Content-Length':bytes.length});
   res.write(bytes.subarray(0,cut));
   setTimeout(()=>res.destroy(),100);
  }else{
   const offset=Number(req.headers.range?.match(/^bytes=(\d+)-$/)?.[1]);
   if(offset!==cut){res.writeHead(400);res.end();return}
   res.writeHead(206,{'Content-Length':bytes.length-offset,'Content-Range':'bytes '+offset+'-'+(bytes.length-1)+'/'+bytes.length});
   res.end(bytes.subarray(offset));
  }
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const root=await mkdtemp(join(tmpdir(),'w1-interrupted-'));
 try{
  const official={...asset,size:bytes.length,maxBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const fetchImpl=async(url,options)=>{
   const result=await fetch('http://127.0.0.1:'+server.address().port,options);
   return {url,headers:result.headers,body:result.body,status:result.status,ok:result.ok};
  };
  const destination=join(root,'runtime.zip');
  await downloadVerifiedAsset({asset:official,destination,assetType:'engine',fetchImpl,retryDelayMs:1});
  assert.deepEqual(ranges,[undefined,'bytes=65000-']);
  assert.deepEqual(await readFile(destination),bytes);
 }finally{server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true})}
});

test('retomada após reabrir reinicia com segurança quando o servidor ignora Range',async()=>{
 const {writeFile}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'w1-resume-'));
 try{
  const destination=join(root,'runtime.zip');
  await writeFile(destination+'.'+digest+'.part',payload.subarray(0,8));
  await downloadVerifiedAsset({asset:{...asset,size:payload.length},destination,assetType:'engine',fetchImpl:async(url,{headers})=>{
   assert.equal(headers.Range,'bytes=8-');
   return response();
  }});
  assert.deepEqual(await readFile(destination),payload);
 }finally{await rm(root,{recursive:true,force:true})}
});
