import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));

test('PredictBot de PC abre em conversa simples, sem formulário técnico nem prompt de pareamento',()=>{
 const html=read('src/predictbot.html');
 const doc=new JSDOM(html).window.document;
 for(const id of ['chat-list','chat-new','chat-messages','chat-input','chat-send','chat-form','chat-status'])assert.ok(doc.getElementById(id),id);
 for(const id of ['opencode-form','oc-executable','oc-directory','oc-user','oc-company','oc-mcp-config'])assert.equal(doc.getElementById(id),null,'Não mostrar '+id);
 assert.match(html,/predictbot-ui\.js/);
 assert.match(html,/predictbot\.css/);
 assert.doesNotMatch(html,/Insira a URL do servidor|Identificador local do usuário|Pasta ou executável do OpenCode/);
});

test('conecta automaticamente, abre conversa e envia somente mensagem pedida',async()=>{
 const dom=new JSDOM(read('src/predictbot.html'),{url:'file:///w1/predictbot.html',runScripts:'outside-only'});
 const actions=[];
 dom.window.w1Central={
  openCode:async(action,input)=>{
   actions.push({action,input});
   if(action==='autoStart')return {connected:true,version:'2.2.0',sessions:[],preferredModel:null};
   if(action==='create')return {id:'ses_test'};
   if(action==='sessions')return [{id:'ses_test'}];
   if(action==='messages')return [{info:{role:'assistant'},parts:[{type:'text',text:'Resposta segura <script>não executar</script>'}]}];
   return {accepted:true};
  },
  onLocalAIProgress:()=>()=>{}
 };
 try{
  dom.window.eval(read('src/predictbot-ui.js'));
  await tick();
  assert.equal(actions[0].action,'autoStart');
  const doc=dom.window.document;
  doc.getElementById('chat-new').click();await tick();
  doc.getElementById('chat-input').value='Olá';
  doc.getElementById('chat-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await tick();
  assert.equal(actions.filter(a=>a.action==='prompt').length,1);
  assert.equal(actions.find(a=>a.action==='prompt').input.text,'Olá');
  assert.equal(doc.querySelector('#chat-messages script'),null);
 }finally{dom.window.close();}
});
