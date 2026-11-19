import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalPredictBotChat} from '../src/predictbot-local.mjs';

test('modelo selecionado e habilidades alteram resposta sem pedir configuração manual',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pb-model-'));
 let request;
 const bot=new LocalPredictBotChat({
  file:join(root,'chat.json'),
  loadRuntime:async()=>({endpoint:'http://127.0.0.1:8765/v1',key:'a'.repeat(64)}),
  fetchImpl:async(_url,init)=>{request=JSON.parse(init.body);return Response.json({choices:[{message:{content:'Resumo confirmado'}}]})}
 });
 try{
  await bot.start();
  const models=await bot.act('models');
  assert.ok(models.some(x=>x.id==='w1-qwen3-1.7b'&&x.available));
  const session=await bot.act('create',{title:'Análise'});
  await bot.act('setSkill',{sessionId:session.id,skill:'summary'});
  await bot.act('prompt',{sessionId:session.id,text:'Resuma o conteúdo'});
  assert.equal(request.model,'w1-qwen3-1.7b');
  assert.equal(request.messages[0].role,'system');
  assert.match(request.messages[0].content,/resum/i);
  await assert.rejects(()=>bot.act('setSkill',{sessionId:session.id,skill:'system-shell'}),/habilidade/i);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('anexo de texto selecionado entra no prompt local, anexo sem suporte nunca vira resposta fingida',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pb-attachment-'));let input;
 const library={promptText:async(ids)=>{if(ids.includes('bad'))throw Error('Arquivo não suportado');return '[Arquivo: notas.txt] conteúdo autorizado'}};
 const bot=new LocalPredictBotChat({file:join(root,'chat.json'),library,
  loadRuntime:async()=>({endpoint:'http://127.0.0.1:8765/v1',key:'a'.repeat(64)}),
  fetchImpl:async(_url,opts)=>{input=JSON.parse(opts.body);return Response.json({choices:[{message:{content:'Analisado'}}]});}
 });
 try{
  await bot.start();const session=await bot.act('create',{title:'Arquivo'});
  await bot.act('prompt',{sessionId:session.id,text:'Resuma',attachmentIds:['one']});
  assert.match(input.messages.at(-1).content,/notas.txt/);
  await assert.rejects(()=>bot.act('prompt',{sessionId:session.id,text:'Veja PDF',attachmentIds:['bad']}),/não suportado/i);
 }finally{rmSync(root,{recursive:true,force:true});}
});
