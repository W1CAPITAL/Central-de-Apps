'use strict';
(()=>{
 const bridge=window.w1Central;
 if(!bridge?.openCode)return;
 const byId=id=>document.getElementById(id);
 const list=byId('chat-list'),messages=byId('chat-messages'),input=byId('chat-input');
 const form=byId('chat-form'),send=byId('chat-send'),status=byId('chat-status');
 const alert=byId('chat-alert'),retry=byId('chat-retry');
 const app=document.querySelector('.pb-app');
 let ready=false,busy=false,booting=false,currentSession='',polling=false;
 let sessionTitles={};
 try{const stored=JSON.parse(localStorage.getItem('w1.predictbot.chatTitles')||'{}');
  if(stored&&typeof stored==='object'&&!Array.isArray(stored))sessionTitles=stored;}catch{}
 let sessions=[];
 const call=(action,input={})=>bridge.openCode(action,input);
 const setStatus=(value,connected=false)=>{status.textContent=value;status.classList.toggle('ready',connected)};
 const updateButton=()=>{send.disabled=!ready||busy||!input.value.trim()};
 const note=(value)=>{alert.textContent=value;alert.hidden=!value;retry.hidden=!value};
 const remember=(id,title)=>{
  if(!/^ses[a-zA-Z0-9_-]+$/.test(id))return;
  sessionTitles[id]=String(title||'Nova conversa').trim().slice(0,70)||'Nova conversa';
  const entries=Object.entries(sessionTitles).slice(-75);
  sessionTitles=Object.fromEntries(entries);
  try{localStorage.setItem('w1.predictbot.chatTitles',JSON.stringify(sessionTitles));}catch{}
 };
 const titleFor=session=>session?.title||sessionTitles[session.id]||'Conversa anterior';
 const add=(role,text,pending=false)=>{
  const box=document.createElement('article');
  box.className='pb-message '+(role==='user'?'user':'assistant')+(pending?' pending':'');
  const body=document.createElement('div');body.className='body';
  body.textContent=String(text||'');box.append(body);messages.append(box);
  messages.scrollTop=messages.scrollHeight;
  return box;
 };
 const normalize=payload=>{
  const rows=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.messages)?payload.messages:[];
  return rows.map(row=>{
   const info=row.info||row.message||row;
   const role=info.role==='user'?'user':info.role==='assistant'?'assistant':null;
   if(!role)return null;
   const parts=Array.isArray(row.parts)?row.parts:Array.isArray(row.content)?row.content:[];
   const body=parts.filter(p=>p?.type==='text').map(p=>p.text||'').join('')||
     (typeof row.text==='string'?row.text:typeof info.content==='string'?info.content:'');
   return body?{role,text:body}:null;
  }).filter(Boolean);
 };
 function render(payload){
  const entries=normalize(payload);
  messages.replaceChildren();
  if(!entries.length){
   const welcome=document.createElement('div');welcome.className='pb-welcome';welcome.id='chat-welcome';
   const heading=document.createElement('h1');heading.textContent='Como posso ajudar?';
   const desc=document.createElement('p');desc.textContent='Escreva sua mensagem. O PredictBot está pronto para conversar.';
   welcome.append(heading,desc);messages.append(welcome);
  }else entries.forEach(x=>add(x.role,x.text));
  return entries;
 }
 function renderList(){
  list.replaceChildren();
  for(const session of sessions){
   if(!session?.id)continue;
   const button=document.createElement('button');
   button.type='button';
   button.className=session.id===currentSession?'active':'';
   button.textContent=titleFor(session);
   button.title=titleFor(session);
   button.addEventListener('click',()=>{void selectSession(session.id)});
   list.append(button);
  }
 }
 async function loadSessions(preferred){
  const result=await call('sessions');
  sessions=Array.isArray(result)?result:[];
  if(preferred&&sessions.some(s=>s.id===preferred))currentSession=preferred;
  if(currentSession&&!sessions.some(s=>s.id===currentSession))currentSession='';
  renderList();
 }
 async function selectSession(id){
  if(!sessions.some(s=>s.id===id))return;
  currentSession=id;renderList();note('');
  try{render(await call('messages',{sessionId:id}))}
  catch(error){note('Não foi possível recuperar a conversa: '+(error.message||'erro desconhecido'))}
 }
 async function createSession(){
  if(!ready)throw Error('O assistente ainda está preparando a conexão.');
  const session=await call('create',{title:'Nova conversa',mode:'restricted'});
  if(!session?.id)throw Error('Não foi possível criar a conversa.');
  currentSession=session.id;remember(session.id,'Nova conversa');
  await loadSessions(session.id);
  render([]);
  return session;
 }
 async function refresh(){
  if(!ready||!currentSession||polling||busy||document.hidden)return;
  polling=true;
  try{render(await call('messages',{sessionId:currentSession}))}
  catch(error){setStatus('Conexão instável · tentando novamente',false)}
  finally{polling=false}
 }
 async function bootstrap(){
  if(booting)return;
  booting=true;ready=false;updateButton();note('');
  setStatus('Conectando automaticamente…');
  try{
   const result=await call('autoStart');
   if(!result?.connected)throw Error(result?.message||'O assistente ainda não está disponível.');
   ready=true;
   setStatus(result.mode==='local'?'IA local ativa':'OpenCode conectado',true);
   await loadSessions(currentSession);
   if(currentSession)await selectSession(currentSession);
   else if(sessions.length)await selectSession(sessions[0].id);
   else render([]);
  }catch(error){
   ready=false;
   setStatus('Não conectado');
   note((error?.message||'Falha ao iniciar.')+' Tente novamente. Nenhuma configuração técnica é necessária.');
  }finally{booting=false;updateButton();}
 }
 async function submit(){
  if(!ready||busy)return;
  const text=input.value.trim();
  if(!text||text.length>12000)return;
  busy=true;updateButton();note('');
  try{
   if(!currentSession)await createSession();
   if(sessionTitles[currentSession]==='Nova conversa')remember(currentSession,text.slice(0,46));
   renderList();
   if(messages.querySelector('.pb-welcome'))messages.replaceChildren();
   add('user',text);
   const waiting=add('assistant','Escrevendo resposta…',true);
   input.value='';
   const result=await call('prompt',{sessionId:currentSession,text});
   if(result?.cancelled){waiting.remove();note('Envio cancelado.');return;}
   const actual=await call('messages',{sessionId:currentSession});
   const entries=render(actual);
   if(!entries.some(x=>x.role==='assistant'))add('assistant','Aguardando a resposta do modelo…',true);
   setStatus('Conectado',true);
  }catch(error){note('Não foi possível enviar: '+(error?.message||'erro inesperado')+'. Para evitar mensagens duplicadas, o PredictBot não reenviará automaticamente.');}
  finally{busy=false;updateButton()}
 }
 form.addEventListener('submit',event=>{event.preventDefault();void submit()});
 input.addEventListener('input',updateButton);
 input.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void submit();}
 });
 byId('chat-new').addEventListener('click',async()=>{
  if(!ready||busy)return;
  try{await createSession();app.classList.add('sidebar-hidden');}
  catch(error){note(error.message||'Não foi possível criar a conversa.');}
 });
 byId('chat-sidebar-toggle').addEventListener('click',()=>app.classList.toggle('sidebar-hidden'));
 retry.addEventListener('click',()=>{void bootstrap()});
 bridge.onLocalAIProgress?.(state=>{
  if(!ready&&!state?.message)return;
  if(!ready&&state?.message){
   const percent=Number.isFinite(state.percent)?' '+Math.round(state.percent)+'%':'';
   setStatus(String(state.message).slice(0,95)+percent);
  }
 });
 setInterval(()=>{void refresh()},3000);
 void bootstrap();
})();
