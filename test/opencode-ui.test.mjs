import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../src/store.html',import.meta.url),'utf8');
const script=await readFile(new URL('../src/opencode-ui.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function page(){const dom=new JSDOM(html,{runScripts:'outside-only',url:'file:///w1/store.html'});const calls=[];dom.window.w1Central={getState:async()=>({apps:[],release:{}}),onState:()=>{},openCode:async(action,input)=>{calls.push({action,input});if(action==='connect')return {version:'2.3.0',capabilities:['health']};if(action==='sessions')return [{id:'ses_approved'}];if(action==='detect')return {installed:true,version:'2.3.0',executable:'C:/OpenCode/opencode.exe'};if(action==='messages')return {text:'<script>do not execute</script>'};return {accepted:true};}};dom.window.eval(script);await tick();return {dom,calls,doc:dom.window.document};}
test('conecta por IPC, limpa senha e recupera sessão',async()=>{const {dom,calls,doc}=await page();try{doc.getElementById('oc-password').value='synthetic-only';const form=doc.getElementById('opencode-form');form.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:form.querySelector('button[type=submit]')}));await tick();assert.equal(calls.find(c=>c.action==='connect').input.password,'synthetic-only');assert.equal(doc.getElementById('oc-password').value,'');assert.equal(doc.getElementById('oc-workspace').hidden,false);assert.equal(doc.getElementById('oc-session').value,'ses_approved');assert.match(doc.getElementById('opencode-status').textContent,/2.3.0/);}finally{dom.window.close();}});
test('conteúdo do executor é mostrado como texto e diff usa sessão selecionada',async()=>{const {dom,calls,doc}=await page();try{const option=doc.createElement('option');option.value='ses_approved';doc.getElementById('oc-session').append(option);doc.getElementById('oc-messages').click();await tick();assert.match(doc.getElementById('oc-output').textContent,/<script>/);assert.equal(doc.getElementById('oc-output').querySelector('script'),null);doc.getElementById('oc-diff').click();await tick();assert.equal(calls.find(c=>c.action==='diff').input.sessionId,'ses_approved');}finally{dom.window.close();}});
test('desconectar remove respostas e fecha área de trabalho',async()=>{const {dom,calls,doc}=await page();try{doc.getElementById('oc-output').textContent='Synthetic result';doc.getElementById('oc-disconnect').click();await tick();assert.equal(doc.getElementById('oc-output').textContent,'');assert.equal(doc.getElementById('oc-workspace').hidden,true);assert.ok(calls.some(c=>c.action==='disconnect'));}finally{dom.window.close();}});


test('assistente de um clique preenche o formulário e confirma conexão pelo submitter',async()=>{
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'file:///w1/store.html'});
 const calls=[];
 dom.window.w1Central={
  openCode:async(action,input)=>{
   calls.push({action,input});
   if(action==='simpleSetup')return {installed:true,executable:'C:/OpenCode/opencode.exe',directory:'C:/Users/Test/Documents/W1 Capital/Projetos',userId:'windows-user-local',companyId:'w1-local-only'};
   if(action==='connect')return {version:'2.3.0',capabilities:[]};
   if(action==='sessions')return[];
   return {installed:false};
  }
 };
 dom.window.eval(script);
 try{
  dom.window.document.getElementById('oc-simple-setup').click();
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.ok(calls.some(c=>c.action==='simpleSetup'));
  assert.ok(calls.some(c=>c.action==='connect'),'configuração simples deve conectar, não apenas preencher campos');
 }finally{dom.window.close()}
});
