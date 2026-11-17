const DEFAULT_URL='https://predictbot-opencode.daviconcentrix.workers.dev';
let active=null;
export function stopOpenCodeRelay(){active?.stop();active=null;}
export function registerOpenCodeRelay({ipcMain,dialog,shell,controller,isTrusted,createClient=async options=>{const {OpenCodeRelayClient}=await import('@w1capital/predictbot-opencode/relay');return new OpenCodeRelayClient(options);}}){
 let state={state:'stopped'},busy=false;
 const announce=(event,patch)=>{state={...state,...patch};if(!event.sender.isDestroyed?.())event.sender.send('central:opencode-relay-state',state);};
 ipcMain.handle('central:opencode-relay',async(event,action,input={})=>{
  if(!isTrusted(event))throw Error('Origem não autorizada.');
  if(action==='state')return state;
  if(action==='openPortal'){await shell.openExternal(DEFAULT_URL+'/connect');return {opened:true};}
  if(action==='stop'){stopOpenCodeRelay();announce(event,{state:'stopped'});return state;}
  if(action!=='pair'||!input||typeof input.pairingCode!=='string'||input.pairingCode.length>2000||typeof input.name!=='string'||input.name.length>80)throw Error('Solicitação de pareamento inválida.');
  if(busy)throw Error('Um pareamento já está em andamento.');
  const adapter=controller().getRelayAdapter();busy=true;
  try{
   const choice=await dialog.showMessageBox({type:'question',title:'Conectar OpenCode à nuvem',message:'Parear este computador com a W1 Capital?',detail:'Confirme o dispositivo na página de conexão. Tarefas remotas de escrita também pedirão confirmação neste computador. A porta local do OpenCode não será publicada.',buttons:['Parear computador','Cancelar'],defaultId:1,cancelId:1,noLink:true});
   if(choice.response!==0)return {cancelled:true};
   stopOpenCodeRelay();
   active=await createClient({url:DEFAULT_URL,onState:patch=>announce(event,patch),approve:async job=>{
    const answer=await dialog.showMessageBox({type:'question',title:'Tarefa remota · OpenCode',message:'Autorizar a operação '+job.operation+' neste computador?',detail:JSON.stringify(job.input,null,2),buttons:['Autorizar esta operação','Recusar'],defaultId:1,cancelId:1,noLink:true});return answer.response===0;
   }});
   const result=await active.pair({pairingCode:input.pairingCode,name:input.name,adapter});announce(event,result);return state;
  }catch{stopOpenCodeRelay();announce(event,{state:'unavailable'});throw Error('O pareamento não foi concluído. Gere outro código e confira a conexão local.');}
  finally{busy=false;}
 });
}
