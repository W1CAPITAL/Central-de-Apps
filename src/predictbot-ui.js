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
 let selectedFiles=[];
 const modelPicker=byId('pb-model'),skillPicker=byId('pb-skill');
 const selectedArea=byId('pb-selected-files'),panel=byId('pb-workspace-panel'),panelTitle=byId('pb-panel-title'),panelContent=byId('pb-panel-content');
 let sessionTitles={};
 try{const stored=JSON.parse(localStorage.getItem('w1.predictbot.chatTitles')||'{}');
  if(stored&&typeof stored==='object'&&!Array.isArray(stored))sessionTitles=stored;}catch{}
 let sessions=[];
 const call=(action,input={})=>bridge.openCode(action,input);
 const setStatus=(value,connected=false)=>{status.textContent=value;status.classList.toggle('ready',connected)};
 const updateButton=()=>{send.disabled=!ready||busy||(!input.value.trim()&&!selectedFiles.length)};
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
  if(skillPicker?.value&&skillPicker.value!=='general')await call('setSkill',{sessionId:session.id,skill:skillPicker.value});
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
   await loadAvailableModels();
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
  if((!text&&!selectedFiles.length)||text.length>12000)return;
  busy=true;updateButton();note('');
  try{
   if(!currentSession)await createSession();
   if(sessionTitles[currentSession]==='Nova conversa')remember(currentSession,(text||selectedFiles[0]?.name||'Arquivo').slice(0,46));
   renderList();
   if(messages.querySelector('.pb-welcome'))messages.replaceChildren();
   add('user',(text||'Analisar arquivo')+(selectedFiles.length?'\n'+selectedFiles.map(f=>'Anexo: '+f.name).join(', '):''));
   const waiting=add('assistant','Escrevendo resposta…',true);
   input.value='';
   const result=await call('prompt',{sessionId:currentSession,text,attachmentIds:selectedFiles.map(f=>f.id)});
   if(result?.cancelled){waiting.remove();note('Envio cancelado.');return;}
   const actual=await call('messages',{sessionId:currentSession});
   const entries=render(actual);
   selectedFiles=[];renderSelectedFiles();
   if(!entries.some(x=>x.role==='assistant'))add('assistant','Aguardando a resposta do modelo…',true);
   setStatus('Conectado',true);
  }catch(error){
   if(currentSession)try{render(await call('messages',{sessionId:currentSession}))}catch{}
   note('Não foi possível concluir a resposta: '+(error?.message||'erro inesperado')+'. O envio não será repetido automaticamente.');
  }
  finally{busy=false;updateButton()}
 }
 function renderSelectedFiles(){
  selectedArea.replaceChildren();
  for(const file of selectedFiles){
   const chip=document.createElement('span');chip.className='pb-file-chip';
   const label=document.createElement('span');label.textContent=file.name+(file.supportedByLocalModel?'':' · só biblioteca');
   const remove=document.createElement('button');remove.type='button';remove.textContent='✕';remove.title='Retirar da mensagem';
   remove.addEventListener('click',()=>{selectedFiles=selectedFiles.filter(f=>f.id!==file.id);renderSelectedFiles();updateButton()});
   chip.append(label,remove);selectedArea.append(chip);
  }
 }
 async function loadAvailableModels(){
  if(!modelPicker)return;
  let models;
  try{models=await call('models')}catch{}
  if(!Array.isArray(models)||!models.length)return;
  const available=models.filter(model=>model?.available&&model?.id);
  modelPicker.replaceChildren();
  for(const model of available){
   const option=document.createElement('option');
   option.value=model.id;option.textContent=model.name||model.id;
   modelPicker.append(option);
  }
 }
 function textElement(tag,value){
  const node=document.createElement(tag);node.textContent=value;return node;
 }
 async function displayPanel(kind){
  panel.hidden=false;panelContent.replaceChildren();
  const titles={library:'Biblioteca',skills:'Habilidades',plugins:'Plugins',settings:'Configurações'};
  panelTitle.textContent=titles[kind]||'PredictBot';
  if(kind==='library'){
   panelContent.append(textElement('p','Os arquivos ficam somente neste computador. O Qwen3 atual interpreta trechos de TXT, Markdown, JSON e CSV; mídias e PDFs exigem outros motores.'));
   if(!bridge.predictBotFiles)return;
   try{
    const files=await bridge.predictBotFiles('list');
    if(!files.length)panelContent.append(textElement('p','Sua biblioteca ainda está vazia.'));
    for(const file of files){
     const row=document.createElement('div');row.className='pb-library-row';
     const name=textElement('span',file.name+(file.supportedByLocalModel?' · texto':' · salvo'));
     const choose=document.createElement('button');choose.type='button';choose.textContent='Usar';
     choose.addEventListener('click',()=>{
      if(selectedFiles.length>=4){note('Escolha até quatro anexos por mensagem.');return;}
      if(!selectedFiles.some(x=>x.id===file.id))selectedFiles.push(file);
      renderSelectedFiles();updateButton();panel.hidden=true;
     });
     const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';remove.className='pb-minor';
     remove.addEventListener('click',async()=>{await bridge.predictBotFiles('remove',{id:file.id});selectedFiles=selectedFiles.filter(x=>x.id!==file.id);renderSelectedFiles();await displayPanel('library')});
     row.append(name,choose,remove);panelContent.append(row);
    }
   }catch(error){panelContent.append(textElement('p','Não foi possível carregar a biblioteca: '+error.message))}
  }else if(kind==='skills'){
   panelContent.append(textElement('p','As habilidades ajustam a maneira de responder nesta conversa, sem executar comandos no computador.'));
   for(const [id,name] of [['general','Conversa'],['summary','Resumir'],['explain','Explicar'],['code','Programar']]){
    const button=document.createElement('button');button.className='pb-tool-item';button.type='button';button.textContent=name;
    button.addEventListener('click',()=>{skillPicker.value=id;skillPicker.dispatchEvent(new window.Event('change'));panel.hidden=true});
    panelContent.append(button);
   }
  }else if(kind==='plugins'){
   panelContent.append(textElement('p','O Qwen3 local é um modelo de texto e não executa plugins. Ferramentas MCP do OpenCode só ficam disponíveis quando o OpenCode está conectado e autorizado.'));
   try{
    const plugins=await call('mcp');
    if(Array.isArray(plugins))panelContent.append(textElement('p',plugins.length+' servidores MCP reconhecidos.'));
   }catch{}
  }else if(kind==='settings'){
   const label=document.createElement('label');label.className='pb-settings-option';
   const input=document.createElement('input');input.type='checkbox';input.checked=document.body.classList.contains('pb-large-type');
   input.addEventListener('change',()=>{
    document.body.classList.toggle('pb-large-type',input.checked);
    try{localStorage.setItem('w1.predictbot.largeType',String(input.checked))}catch{}
   });
   label.append(input,textElement('span','Texto maior nas conversas'));panelContent.append(label);
   panelContent.append(textElement('p','Modelo padrão: Qwen3 local. Nenhuma chave ou URL precisa ser configurada para o chat de texto.'));
  }
 }
 try{if(localStorage.getItem('w1.predictbot.largeType')==='true')document.body.classList.add('pb-large-type')}catch{}
 byId('pb-panel-close')?.addEventListener('click',()=>{panel.hidden=true});
 for(const kind of ['library','skills','plugins','settings']){
  byId('pb-'+kind)?.addEventListener('click',()=>{void displayPanel(kind)});
 }
 byId('pb-attach')?.addEventListener('click',async()=>{
  if(!bridge.predictBotFiles){note('Biblioteca indisponível nesta versão.');return}
  try{
   const files=await bridge.predictBotFiles('pick');
   for(const file of files){
    if(selectedFiles.length>=4)break;
    if(!selectedFiles.some(x=>x.id===file.id))selectedFiles.push(file);
   }
   renderSelectedFiles();updateButton();
   if(files.some(x=>!x.supportedByLocalModel))
    note('Os arquivos foram salvos. Para analisar PDF, imagem, ZIP, áudio ou vídeo, será necessário um motor compatível; o Qwen3 local só lê texto.');
  }catch(error){note('Não foi possível adicionar o arquivo: '+error.message)}
 });
 skillPicker?.addEventListener('change',()=>{
  if(currentSession)void call('setSkill',{sessionId:currentSession,skill:skillPicker.value})
   .catch(error=>note('Falha ao mudar habilidade: '+error.message));
 });
 modelPicker?.addEventListener('change',()=>{
  if(currentSession)void call('setModel',{sessionId:currentSession,model:modelPicker.value})
   .catch(error=>note('Modelo não disponível: '+error.message));
 });
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
