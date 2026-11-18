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
 byId('oc-detect').addEventListener('click',async()=>{try{const found=await request('detect',{executable:byId('oc-executable').value.trim()});status.textContent=found.installed?'OpenCode '+found.version+' encontrado':found.message;if(found.installed)byId('oc-executable').value=found.executable;}catch{status.textContent='Não foi possível detectar a instalação.';}});
 byId('oc-disconnect').addEventListener('click',async()=>{connected=false;generation++;clearInterval(timer);await request('disconnect');output.textContent='';byId('oc-workspace').hidden=true;status.textContent='Desconectado';byId('oc-password').value='';});
 byId('oc-create').addEventListener('click',async()=>{try{const session=await run('create',{title:'Tarefa W1 Capital',mode:byId('oc-permissions').value});await refreshSessions();sessions.value=session.id;}catch{}});
 bind('oc-send','prompt',()=>({sessionId:sessions.value,text:byId('oc-prompt').value}));
 bind('oc-messages','messages');bind('oc-diff','diff');bind('oc-abort','abort');
 bind('oc-mcp-list','mcp');
 bind('oc-mcp-save','mcpSave',()=>({name:byId('oc-mcp-name').value.trim(),config:JSON.parse(byId('oc-mcp-config').value)}));
 for(const [id,action] of [['oc-mcp-connect','mcpConnect'],['oc-mcp-disconnect','mcpDisconnect'],['oc-mcp-remove','mcpRemove']])bind(id,action,()=>({name:byId('oc-mcp-name').value.trim()}));
}
})();
