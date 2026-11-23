import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForLocalHealth} from '../src/local-health.mjs';

const nonce='a'.repeat(48),wrong='b'.repeat(48);
const makeResponse=(status,body)=>({ok:status>=200&&status<300,status,async json(){return body;}});
const common={name:'LexisPredict',nonce,url:'http://127.0.0.1:49321/api/desktop/health',wait:async()=>{},timeout:500,attempts:3,alive:()=>true};

test('servidor lento responde na terceira tentativa sem ser confundido com falha de segurança',async()=>{
 let n=0;
 const result=await waitForLocalHealth({...common,fetchImpl:async()=>{
  n++;if(n<3)throw Object.assign(Error('connect ECONNREFUSED'),{code:'ECONNREFUSED'});
  return makeResponse(200,{ready:true,nonce});
 }});
 assert.equal(result.ready,true);
 assert.equal(n,3);
});

test('HTTP 404 da rota local informa erro específico, sem expor nonce nem dados do servidor',async()=>{
 await assert.rejects(waitForLocalHealth({...common,attempts:2,fetchImpl:async()=>makeResponse(404,{ready:false})}),
  error=>{assert.match(error.message,/LexisPredict.*HTTP 404/);assert.ok(!error.message.includes(nonce));return true;});
});

test('HTTP 503 não pode virar mensagem genérica de segurança',async()=>{
 await assert.rejects(waitForLocalHealth({...common,fetchImpl:async()=>makeResponse(503,{})}),/LexisPredict.*HTTP 503/);
});

test('nonce errado bloqueia imediatamente outra instância na porta do servidor',async()=>{
 let n=0;
 await assert.rejects(waitForLocalHealth({...common,fetchImpl:async()=>{n++;return makeResponse(200,{ready:true,nonce:wrong});}}),
 /Identidade da sessão local/);
 assert.equal(n,1);
});

test('erro de inicialização do processo é propagado sem executar verificações extras',async()=>{
 let aliveChecks=0;
 await assert.rejects(waitForLocalHealth({...common,alive:()=>{aliveChecks++;return false;},fetchImpl:async()=>{throw Error('fetch não deve ser usado');}}),/encerrou antes de iniciar/);
 assert.equal(aliveChecks,1);
});

test('não revela conteúdo da resposta, cabeçalhos, nem chaves nos erros',async()=>{
 await assert.rejects(waitForLocalHealth({...common,attempts:1,fetchImpl:async()=>{throw Error('senha de acesso secreta');}}),
 e=>{assert.doesNotMatch(e.message,/senha de acesso secreta/);return true;});
});
