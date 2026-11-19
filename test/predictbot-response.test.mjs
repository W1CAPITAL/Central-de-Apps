import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAnswerText,buildLocalCompletion} from '../src/predictbot-response.mjs';

test('Qwen3 responde diretamente sem gastar tokens só no raciocínio',()=>{
 const payload=buildLocalCompletion([{role:'user',content:'oi'}],{small:true});
 assert.equal(payload.chat_template_kwargs.enable_thinking,false);
 assert.equal(payload.model,'w1-qwen3-1.7b');
 assert.match(payload.messages.at(-1).content,/\/no_think/);
 assert.ok(payload.max_tokens>=256);
});
test('texto em content string ou partes estruturadas funciona',()=>{
 assert.equal(extractAnswerText({choices:[{message:{content:'Olá!'}}]}),'Olá!');
 assert.equal(extractAnswerText({choices:[{message:{content:[{type:'text',text:'Resposta '},{type:'text',text:'válida'}]}}]}),'Resposta válida');
});
test('não mostra raciocínio interno como resposta e explica truncamento',()=>{
 assert.throws(()=>extractAnswerText({choices:[{finish_reason:'length',message:{content:'',reasoning_content:'Raciocínio interno privado'}}]}),/limite|resposta/i);
});
test('resposta vazia comum apresenta diagnóstico claro',()=>{
 assert.throws(()=>extractAnswerText({choices:[{message:{content:null}}]}),/texto/i);
});

test('não expõe blocos de raciocínio quando servidor antigo mistura think em content',()=>{
 assert.equal(extractAnswerText({choices:[{message:{content:'<think>interno e privado</think>Olá, posso ajudar.'}}]}),'Olá, posso ajudar.');
});
