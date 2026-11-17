import {app,BrowserWindow,ipcMain,Menu,shell,dialog,session} from 'electron';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {registerOpenCodeRelay,stopOpenCodeRelay} from './opencode-relay-ipc.mjs';
import {OpenCodeController} from './opencode-controller.mjs';
import {APPS,resolveApp} from './catalog.mjs';
import {reserveStablePort,safeEnvironment,isLocalUrl,isSafeExternalUrl} from './runtime-policy.mjs';
import {validateReleaseAsset,downloadSignedRelease,verifyWindowsSignature,verifyFileDigest} from './update-security.mjs';

const STORE_FILE=join(import.meta.dirname,'store.html');
const UPDATE_API='https://api.github.com/repos/W1CAPITAL/Central-de-Apps/releases/latest';
const running=new Map();
const windows=new Map();
const states=Object.fromEntries(Object.keys(APPS).map(id=>[id,{phase:'bundled',message:'Pronto para iniciar no Windows'}]));
let storeWindow=null;
let release={version:null,notes:'',url:null,checkedAt:null,error:null,phase:'none',canDownload:false,percent:0};
let verifiedAsset=null,downloadedInstaller=null,downloadPromise=null,installing=false;
let checking=false,closing=false;
let openCode;
function getOpenCode(){return openCode||(openCode=new OpenCodeController({stateDirectory:join(app.getPath('userData'),'opencode-sessions')}));}

if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',()=>{void app.whenReady().then(openStoreWindow)});

function publicState(){
 return {
  apps:Object.values(APPS).map(app=>({...app,status:{...states[app.id]}})),
  release:{...release},
  storeVersion:app.getVersion()
 };
}
function announce(){
 if(storeWindow&&!storeWindow.isDestroyed())storeWindow.webContents.send('central:state',publicState());
}
function setStatus(id,phase,message){
 states[id]={phase,message:String(message).slice(0,260)};
 announce();
}
function trustedStoreEvent(event){
 return storeWindow&&!storeWindow.isDestroyed()&&
  event.sender===storeWindow.webContents&&
  event.senderFrame?.url===pathToFileURL(STORE_FILE).href;
}
function productFolder(id){
 resolveApp(id);
 return app.isPackaged?join(process.resourcesPath,'products',id):
  join(import.meta.dirname,'..','products',id);
}
function productEntry(id){
 const dir=productFolder(id),entry=join(dir,'server.js');
 const next=join(dir,'node_modules','next','package.json');
 if(!existsSync(entry)||!existsSync(next))
  throw Error('Produto não está no pacote local: '+id+'. Reinstale a Central de Apps.');
 return {dir,entry};
}
async function waitForProduct(id,record){
 const url='http://127.0.0.1:'+record.port+resolveApp(id).localHealth;
 for(let i=0;i<85;i++){
  if(record.child.exitCode!==null||record.child.signalCode!==null)
   throw Error('O servidor local do '+resolveApp(id).name+' encerrou antes de iniciar.');
  try{
   const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(850)});
   if(response.ok){
    const data=await response.json();
    if(data?.ready===true&&data?.nonce===record.nonce)return;
    throw Error('Identidade da sessão local não corresponde ao produto instalado.');
   }
  }catch(error){
   if(error?.message?.startsWith('Identidade da sessão'))throw error;
  }
  await sleep(300);
 }
 throw Error('O servidor local do '+resolveApp(id).name+' não respondeu ao teste de segurança.');
}
async function startProduct(id){
 const old=running.get(id);
 if(old&&old.child.exitCode===null&&old.child.signalCode===null)return old;
 running.delete(id);
 const {dir,entry}=productEntry(id);
 // The private loopback port is per app, not per window, preserving login
 // across updates and preventing a port clash between both Supabase clients.
 const port=await reserveStablePort(app.getPath('userData'),id);
 const nonce=randomBytes(24).toString('hex');
 const child=spawn(process.execPath,[entry],{
  cwd:dir,windowsHide:true,shell:false,
  stdio:['ignore','ignore','pipe'],
  env:safeEnvironment(id,port,nonce)
 });
 child.stderr?.resume();
 const record={child,port,nonce};
 child.once('error',()=>{if(running.get(id)===record){
  running.delete(id);setStatus(id,'error','Falha ao iniciar servidor local.');}});
 child.once('exit',()=>{if(running.get(id)===record){
  running.delete(id);setStatus(id,'error','Servidor local encerrado.');}});
 running.set(id,record);
 try{await waitForProduct(id,record)}
 catch(error){if(child.exitCode===null)child.kill();running.delete(id);throw error}
 return record;
}
function productBrowser(id,port){
 const win=new BrowserWindow({
  width:1380,height:880,minWidth:780,minHeight:520,
  show:false,backgroundColor:'#101017',
  title:resolveApp(id).name+' · W1 Capital',
  webPreferences:{
   nodeIntegration:false,contextIsolation:true,sandbox:true,
   session:session.fromPartition('persist:central-'+id)
  }
 });
 win.webContents.setWindowOpenHandler(({url})=>{
  if(isSafeExternalUrl(url))void shell.openExternal(url).catch(()=>{});
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(e,url)=>{
  if(isLocalUrl(url,port))return;
  e.preventDefault();
  if(isSafeExternalUrl(url))void shell.openExternal(url).catch(()=>{});
 });
 win.webContents.session.setPermissionRequestHandler((_sender,permission,callback)=>{
  // No background microphone, camera or clipboard access without a dedicated workflow.
  callback(false);
 });
 win.once('ready-to-show',()=>win.show());
 win.on('closed',()=>{windows.delete(id);announce()});
 return win;
}
async function openProduct(id){
 resolveApp(id);
 const current=windows.get(id);
 if(current&&!current.isDestroyed()){current.show();current.focus();return publicState()}
 setStatus(id,'starting','Iniciando '+resolveApp(id).name+' no seu computador, sem Vercel...');
 try{
  const record=await startProduct(id);
  const win=productBrowser(id,record.port);
  windows.set(id,win);
  await win.loadURL('http://127.0.0.1:'+record.port+resolveApp(id).localEntry);
  win.show();
  setStatus(id,'running','Aplicativo aberto no servidor Next.js local.');
 }catch(error){
  setStatus(id,'error',error?.message||'Não foi possível iniciar o aplicativo.');
  const parent=storeWindow&&!storeWindow.isDestroyed()?storeWindow:null;
  await dialog.showMessageBox(parent||undefined,{
   type:'error',title:'Central de Apps W1',message:'Não foi possível abrir '+resolveApp(id).name,
   detail:String(error?.message||'Falha de inicialização local.').slice(0,350),
   buttons:['Entendi']
  });
 }
 return publicState();
}
function compareVersion(v1,v2){
 const norm=s=>String(s||'').replace(/^v/,'').split('.').map(Number);
 const a=norm(v1),b=norm(v2);
 if(a.length!==3||b.length!==3||[...a,...b].some(n=>!Number.isInteger(n)||n<0))return 0;
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]-b[i]}
 return 0;
}
async function checkUpdates(){
 if(checking)return publicState();
 checking=true;
 try{
  const response=await fetch(UPDATE_API,{
   headers:{'Accept':'application/vnd.github+json','User-Agent':'W1-Central-de-Apps'},
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw Error('GitHub Releases indisponível ('+response.status+').');
  const body=await response.text();
  if(body.length>24000)throw Error('Resposta de atualização muito grande.');
  const payload=JSON.parse(body);
  const version=typeof payload.tag_name==='string'?payload.tag_name.replace(/^v/,''):'';
  const html=typeof payload.html_url==='string'?payload.html_url:'';
  if(!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)||!/^https:\/\/github\.com\/W1CAPITAL\/Central-de-Apps\/releases\/tag\/v?[\d.]+$/.test(html))
   throw Error('Release GitHub inválida.');
  const available=compareVersion(version,app.getVersion())>0;
  let asset=null;
  if(available){try{asset=validateReleaseAsset(payload)}catch{}}
  const preserved=available&&verifiedAsset?.version===version&&downloadedInstaller;
  if(!preserved){
   downloadedInstaller=null;
   verifiedAsset=asset;
  }
  release={version,notes:String(payload.body||'').replace(/<[^>]*>/g,'').slice(0,5000),
   url:html,checkedAt:new Date().toISOString(),error:null,available,
   canDownload:!!asset,phase:preserved?'downloaded':available?'available':'none',
   percent:preserved?100:0};
  if(!asset&&!preserved)verifiedAsset=null;
 }catch(error){
  release={...release,checkedAt:new Date().toISOString(),
   error:String(error?.message||'Não foi possível consultar versões.').slice(0,160)};
 }finally{checking=false;announce()}
 return publicState();
}
function signatureScript(){
 return app.isPackaged
  ?join(process.resourcesPath,'app.asar.unpacked','src','verify-signature.ps1')
  :join(import.meta.dirname,'verify-signature.ps1');
}
async function installUpdate(){
 if(installing)return publicState();
 if(!downloadedInstaller||!verifiedAsset||release.phase!=='downloaded')
  throw Error('Nenhum instalador W1 assinado está pronto.');
 const choice=await dialog.showMessageBox(storeWindow&&!storeWindow.isDestroyed()?storeWindow:undefined,{
  type:'question',title:'Atualizar Central W1',
  message:'A versão '+verifiedAsset.version+' está pronta para instalar.',
  detail:'Para aplicar a atualização, todos os aplicativos abertos serão fechados. Salve seu trabalho antes de continuar.',
  buttons:['Instalar e reiniciar','Depois'],defaultId:1,cancelId:1,noLink:true
 });
 if(choice.response!==0)return publicState();
 installing=true;
 try{
  // Verify again immediately before execution: local update files are writable.
  await verifyFileDigest(downloadedInstaller,verifiedAsset);
  await verifyWindowsSignature(downloadedInstaller,signatureScript());
  const result=await shell.openPath(downloadedInstaller);
  if(result)throw Error('O Windows recusou o instalador: '+result);
  app.quit();
 }catch(error){
  release={...release,phase:'error',error:String(error?.message||'Instalação bloqueada.').slice(0,160)};
  announce();
 }finally{installing=false}
 return publicState();
}
async function downloadUpdate(mode='background'){
 if(!['now','background'].includes(mode))throw Error('Modo de atualização inválido.');
 if(downloadPromise)return downloadPromise;
 if(!release.available||!release.canDownload||!verifiedAsset)
  throw Error('Sem atualização oficial com hash e origem válidos.');
 if(downloadedInstaller&&release.phase==='downloaded')
  return mode==='now'?installUpdate():publicState();
 const asset=verifiedAsset;
 release={...release,phase:'downloading',percent:0,error:null};
 announce();
 // Baixar em segundo plano nunca fecha o CRM; a instalação aguarda escolha.
 downloadPromise=downloadSignedRelease({
  asset,folder:join(app.getPath('userData'),'trusted-updates'),
  signatureScript:signatureScript(),
  onProgress:percent=>{
   if(release.version===asset.version){
    release={...release,phase:'downloading',percent};
    announce();
   }
  }
 }).then(async path=>{
  if(verifiedAsset?.version!==asset.version||release.version!==asset.version)
   throw Error('Uma nova release substituiu o download; pacote anterior não será instalado.');
  downloadedInstaller=path;
  release={...release,phase:'downloaded',percent:100,error:null};
  announce();
  if(mode==='now')return installUpdate();
  return publicState();
 }).catch(error=>{
  downloadedInstaller=null;
  release={...release,phase:'error',percent:0,
   error:String(error?.message||'Pacote não validado.').slice(0,160)};
  announce();
  return publicState();
 }).finally(()=>{downloadPromise=null});
 return downloadPromise;
}

function openStoreWindow(){
 if(storeWindow&&!storeWindow.isDestroyed()){storeWindow.show();storeWindow.focus();return storeWindow}
 storeWindow=new BrowserWindow({
  width:1240,height:850,minWidth:840,minHeight:590,
  show:false,backgroundColor:'#0d0c13',
  title:'W1 Capital · Central de Apps',
  webPreferences:{
   preload:join(import.meta.dirname,'preload.cjs'),
   nodeIntegration:false,contextIsolation:true,sandbox:true
  }
 });
 storeWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 storeWindow.webContents.on('will-navigate',e=>e.preventDefault());
 storeWindow.webContents.session.setPermissionRequestHandler((_sender,_permission,callback)=>callback(false));
 storeWindow.on('closed',()=>{storeWindow=null});
 void storeWindow.loadFile(STORE_FILE).then(()=>storeWindow?.show()).catch(()=>{});
 return storeWindow;
}
ipcMain.handle('central:get-state',event=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return publicState();
});
ipcMain.handle('central:launch',async(event,id)=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return openProduct(id);
});
ipcMain.handle('central:check-updates',event=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return checkUpdates();
});
ipcMain.handle('central:download-update',(event,mode)=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return downloadUpdate(mode);
});
ipcMain.handle('central:install-update',event=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return installUpdate();
});
ipcMain.handle('central:open-release',async event=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 if(!release.url||!release.available||!isSafeExternalUrl(release.url))return false;
 await shell.openExternal(release.url);
 return true;
});
ipcMain.handle('central:opencode',async(event,action,input={})=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 if(!input||typeof input!=='object'||JSON.stringify(input).length>50000)throw Error('Solicitação OpenCode inválida.');
 if(action==='detect')return getOpenCode().detect(input.executable);
 if(action==='connect'){stopOpenCodeRelay();return getOpenCode().connect(input);}
 if(action==='disconnect'){stopOpenCodeRelay();return getOpenCode().disconnect();}
 if(action==='prompt'||action==='mcpSave'||action==='mcpRemove'){
  const choice=await dialog.showMessageBox(storeWindow,{
   type:'question',title:'OpenCode · W1 Capital',
   message:action==='prompt'?'Enviar esta tarefa ao OpenCode?':action==='mcpRemove'?'Remover este servidor MCP?':'Registrar este servidor MCP?',
   detail:action==='prompt'?'O provedor configurado no OpenCode pode consumir créditos. As permissões de ferramentas serão verificadas pelo OpenCode.':action==='mcpSave'?(input.config?.type==='local'?'Comando local: '+JSON.stringify(input.config.command):'Servidor remoto: '+String(input.config?.url||'')):'Servidor: '+String(input.name||''),
   buttons:['Continuar','Cancelar'],defaultId:1,cancelId:1,noLink:true
  });
  if(choice.response!==0)return {cancelled:true};
 }
 return getOpenCode().act(action,input);
});
app.whenReady().then(()=>{
 registerOpenCodeRelay({ipcMain,dialog,shell,controller:getOpenCode,isTrusted:trustedStoreEvent});
 Menu.setApplicationMenu(null);
 openStoreWindow();
 // Automatic discovery is non-interruptive. Never execute an unsigned download.
 void checkUpdates();
 const timer=setInterval(()=>void checkUpdates(),30*60*1000);
 timer.unref?.();
}).catch(()=>app.quit());
app.on('before-quit',()=>{
 if(closing)return;
 closing=true;
 stopOpenCodeRelay();
 openCode?.disconnect();
 for(const record of running.values())if(record.child.exitCode===null)record.child.kill();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
