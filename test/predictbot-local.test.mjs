import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalPredictBotChat} from '../src/predictbot-local.mjs';

test('motor local cria e salva conversa privada com resposta real simulada, sem OpenCode instalado',async()=>{
 const root=mkdtempSync(join(tmpdir(),'w1-predict-chat-'));const file=join(root,'chats.json');const calls=[];
 const bot=new LocalPredictBotChat({file,loadRuntime:async()=>({endpoint:'http://127.0.0.1:8765/v1',key:'a'.repeat(64)}),
  fetchImpl:async(url,opts)=>{calls.push({url:String(url),opts});return Response.json({choices:[{message:{content:'Resposta de teste segura'}}]});}});
 try{
  assert.equal((await bot.start()).mode,'local');
  const session=await bot.act('create',{title:'Primeira conversa'});
  assert.match(session.id,/^ses_/);
  const result=await bot.act('prompt',{sessionId:session.id,text:'Olá'});
  assert.equal(result.accepted,true);
  const messages=await bot.act('messages',{sessionId:session.id});
  assert.equal(messages.length,2);assert.equal(messages[0].info.role,'user');assert.equal(messages[1].parts[0].text,'Resposta de teste segura');
  assert.equal(calls.length,1);assert.equal(calls[0].opts.headers.Authorization,'Bearer '+'a'.repeat(64));
  const content=readFileSync(file,'utf8');assert.ok(!content.includes('aaaaaaaaaaaaa'),'Não persistir credenciais');
  assert.equal((await bot.act('sessions')).length,1);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('motor local não consulta sessões desconhecidas e não acessa servidores arbitrários',async()=>{
 const root=mkdtempSync(join(tmpdir(),'w1-predict-safe-'));
 try{
  const bot=new LocalPredictBotChat({file:join(root,'state.json'),loadRuntime:async()=>({endpoint:'https://example.test/v1',key:'a'.repeat(64)})});
  await assert.rejects(()=>bot.start(),/local|endereço/i);
  await assert.rejects(()=>bot.act('messages',{sessionId:'ses_unknown'}),/não encontrada/i);
 }finally{rmSync(root,{recursive:true,force:true})}
});
