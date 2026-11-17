const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('w1Central',Object.freeze({
 openCode:(action,input)=>ipcRenderer.invoke('central:opencode',action,input),
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