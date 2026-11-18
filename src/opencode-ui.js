'use strict';
(()=>{
const bridge=window.w1Central;
if(bridge?.openCode){
 const byId=id=>document.getElementById(id);
 const status=byId('opencode-status'),output=byId('oc-output'),sessions=byId('oc-session');
 let connected=false,polling=false,timer,generation=0,view='messages';
 const show=value=>{output.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);};
 const request=(action,input={})=>bridge.openCode(action,input);
 async function refreshSessions(){const items=await request('sessions');const selected=sessions.value;sessions.replaceChildren(...items.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.id;return o;}));if(items.some(s=>s.id===selected))sessions.value=selected;}
 async function run(action,input){const current=generation;view=action==='prompt'?'messages':action;try{const result=await request(action,input);if(current===generation)show(result);return result;}catch(error){show(String(error.message||'Operação falhou.'));throw error;}}
 function bind(id,action,build){byId(id).addEventListener('click',async()=>{const button=byId(id);button.disabled=true;try{await run(action,build?build():{sessionId:sessions.value});}catch{}finally{button.disabled=false;}});}
 byId('opencode-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;status.textContent='Conectando...';
  clearInterval(timer);connected=false;generation++;const current=generation;output.textContent='';byId('oc-workspace').hidden=true;
  try{
   const result=await request('connect',{mode:byId('oc-mode').value,executable:byId('oc-executable').value.trim(),directory:byId('oc-directory').value.trim(),url:byId('oc-url').value.trim(),password:byId('oc-password').value,userId:byId('oc-user').value.trim(),companyId:byId('oc-company').value.trim()});
   byId('oc-password').value='';connected=true;byId('oc-workspace').hidden=false;status.textContent='Conectado · OpenCode '+result.version;await refreshSessions();show({version:result.version,capabilities:result.capabilities});
   // Poll real responses; never fabricate progress from an animation.
   timer=setInterval(async()=>{if(!connected||polling||!sessions.value||document.hidden||!['messages','prompt'].includes(view))return;polling=true;try{const result=await request('messages',{sessionId:sessions.value});if(current===generation&&view==='messages')show(result);}catch{status.textContent='Falha ao atualizar respostas. Reconecte para testar.';}finally{polling=false;}},5000);
  }catch(error){status.textContent=String(error.message||'Falha de conexão.');}finally{button.disabled=false;}
 });
 byId('oc-simple-setup')?.addEventListener('click',async()=>{
  const button=byId('oc-simple-setup');button.disabled=true;
  status.textContent='Preparando OpenCode no computador...';
  try{
   const executable=byId('oc-executable').value.trim();
   const found=executable?await request('simpleSetup',{executable}):await request('simpleSetup');
   if(!found.installed){status.textContent=found.message || 'Não encontrei a CLI do OpenCode. Escolha o executável ou baixe o OpenCode.';return;}
   byId('oc-mode').value='local';
   byId('oc-executable').value=found.executable;
   byId('oc-directory').value=found.directory;
   byId('oc-user').value=found.userId;
   byId('oc-company').value=found.companyId;
   byId('opencode-form').requestSubmit(byId('opencode-form').querySelector('button[type="submit"]'));
  }catch(error){status.textContent=String(error.message||'Não foi possível preparar a instalação.');}
  finally{button.disabled=false;}
 });
 byId('oc-pick-exe')?.addEventListener('click',async()=>{
  try{
   const path=await request('pickExecutable');
   if(path){byId('oc-executable').value=path;byId('oc-detect').click();}
  }catch{status.textContent='Não foi possível abrir a seleção de arquivo.';}
 });
 byId('oc-download')?.addEventListener('click',async()=>{
  try{await request('officialDownload');}catch{status.textContent='Não foi possível abrir o site do OpenCode.';}
 });
 byId('oc-detect').addEventListener('click',async()=>{try{const found=await request('detect',{executable:byId('oc-executable').value.trim()});status.textContent=found.installed?'OpenCode '+found.version+' encontrado':found.message;if(found.installed)byId('oc-executable').value=found.executable;}catch{status.textContent='Não foi possível detectar a instalação.';}});
 byId('oc-disconnect').addEventListener('click',async()=>{connected=false;generation++;clearInterval(timer);await request('disconnect');output.textContent='';byId('oc-workspace').hidden=true;status.textContent='Desconectado';byId('oc-password').value='';});
 byId('oc-create').addEventListener('click',async()=>{try{const session=await run('create',{title:'Tarefa W1 Capital',mode:byId('oc-permissions').value});await refreshSessions();sessions.value=session.id;}catch{}});

 byId('oc-attach')?.addEventListener('click',async()=>{
  const button=byId('oc-attach');button.disabled=true;
  try{
   const files=await bridge.pickOpenCodeFiles();
   if(!files?.length)return;
   const list=byId('oc-file-list');
   list.replaceChildren(...files.map(f=>{const item=document.createElement('li');item.textContent=f.name+' · '+f.kind;return item;}));
   const note='\n\nArquivos locais selecionados. Leia apenas com autorização do operador (referências, não anexos enviados):\n'+files.map(f=>'- '+JSON.stringify(f.path)).join('\n');
   byId('oc-prompt').value=(byId('oc-prompt').value+note).slice(0,32000);
  }catch(error){status.textContent=String(error.message||'Não foi possível selecionar arquivos.');}
  finally{button.disabled=false;}
 });
 bind('oc-send','prompt',()=>({sessionId:sessions.value,text:byId('oc-prompt').value}));
 bind('oc-messages','messages');bind('oc-diff','diff');bind('oc-abort','abort');
 bind('oc-mcp-list','mcp');
 bind('oc-mcp-save','mcpSave',()=>({name:byId('oc-mcp-name').value.trim(),config:JSON.parse(byId('oc-mcp-config').value)}));
 for(const [id,action] of [['oc-mcp-connect','mcpConnect'],['oc-mcp-disconnect','mcpDisconnect'],['oc-mcp-remove','mcpRemove']])bind(id,action,()=>({name:byId('oc-mcp-name').value.trim()}));
}
})();
