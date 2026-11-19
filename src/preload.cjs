const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('w1Central',Object.freeze({
 downloadProduct:id=>ipcRenderer.invoke('central:download-product',id),
 openOfficialTool:provider=>ipcRenderer.invoke('central:open-official-tool',provider),
 getLingerCapability:()=>ipcRenderer.invoke('central:linger-capability'),
 pickOpenCodeFiles:()=>ipcRenderer.invoke('central:pick-opencode-files'),
 showDownload:id=>ipcRenderer.invoke('central:show-download',id),
 setAutomaticUpdates:enabled=>ipcRenderer.invoke('central:auto-updates',enabled),
 openCodeRelay:(action,input)=>ipcRenderer.invoke('central:opencode-relay',action,input),
 onRelayState:listener=>{if(typeof listener!=='function')return ()=>{};const fn=(_event,state)=>listener(state);ipcRenderer.on('central:opencode-relay-state',fn);return ()=>ipcRenderer.removeListener('central:opencode-relay-state',fn);},
 openCode:(action,input)=>ipcRenderer.invoke('central:opencode',action,input),
 localAI:action=>ipcRenderer.invoke('central:local-ai',action),
 onLocalAIProgress:listener=>{if(typeof listener!=='function')return ()=>{};const fn=(_event,state)=>listener(state);ipcRenderer.on('central:local-ai-state',fn);return ()=>ipcRenderer.removeListener('central:local-ai-state',fn);},
 getState:()=>ipcRenderer.invoke('central:get-state'),
 launch:appId=>ipcRenderer.invoke('central:launch',appId),
 checkUpdates:()=>ipcRenderer.invoke('central:check-updates'),
 downloadUpdate:mode=>ipcRenderer.invoke('central:download-update',mode),
 installUpdate:()=>ipcRenderer.invoke('central:install-update'),
 openRelease:()=>ipcRenderer.invoke('central:open-release'),
 onState:listener=>{
  if(typeof listener!=='function')return ()=>{};
  const fn=(_event,state)=>listener(state);
  ipcRenderer.on('central:state',fn);
  return ()=>ipcRenderer.removeListener('central:state',fn);
 }
}));
