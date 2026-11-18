import {app,BrowserWindow,ipcMain,Menu,shell,dialog,session} from 'electron';
import {spawn} from 'node:child_process';
import {join,dirname} from 'node:path';
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {classifyAttachment,ATTACHMENT_FILTERS} from './attachment-policy.mjs';
import {officialToolUrl} from './official-tools.mjs';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {registerOpenCodeRelay,stopOpenCodeRelay} from './opencode-relay-ipc.mjs';
import {OpenCodeController} from './opencode-controller.mjs';
import {APPS,resolveApp} from './catalog.mjs';
import {reserveStablePort,safeEnvironment,isLocalUrl,isSafeExternalUrl,canonicalProductUrl} from './runtime-policy.mjs';
import {validateReleaseAsset,downloadVerifiedRelease,verifyFileDigest} from './update-security.mjs';
import {createInPlaceUpdatePlan} from './update-install.mjs';
import {productSpec,fetchReleaseCatalog,selectProductRelease} from './distribution.mjs';
import {ProductDownloads} from './product-downloads.mjs';

const BUILD=productSpec(JSON.parse(readFileSync(new URL('./product-build.json',import.meta.url),'utf8')).id);
const previousProfile=app.getPath('userData');
app.setName(BUILD.name);
if(!app.commandLine.hasSwitch('user-data-dir')){
 const profile=BUILD.id==='central'?previousProfile:join(app.getPath('appData'),BUILD.appId);
 mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
}
const STORE_FILE=join(import.meta.dirname,BUILD.id==='predictbot'?'predictbot.html':'store.html');
const BOT_FILE=join(import.meta.dirname,'predictbot.html');
const running=new Map();
const windows=new Map();
const states=Object.fromEntries(Object.keys(APPS).map(id=>[id,{phase:'bundled',message:'Pronto para iniciar no Windows'}]));
let storeWindow=null;
let release={version:null,notes:'',url:null,checkedAt:null,error:null,phase:'none',canDownload:false,percent:0};
let verifiedAsset=null,downloadedInstaller=null,downloadPromise=null,installing=false,handingOffUpdate=false;
let checking=false,closing=false;
let openCode;
let productDownloads;
function downloads(){return productDownloads||(productDownloads=new ProductDownloads({folder:join(app.getPath('downloads'),'W1 Capital'),onState:announce}));}
let automaticUpdates=true;
function setAutomaticUpdates(enabled){
 automaticUpdates=enabled;
 writeFileSync(join(app.getPath('userData'),'automatic-updates.json'),JSON.stringify({enabled}));
 announce();return publicState();
}
function trustedOpenCodeEvent(event){
 const bot=windows.get('predictbot');
 return trustedStoreEvent(event)||!!(bot&&!bot.isDestroyed()&&event.sender===bot.webContents&&event.senderFrame?.url===pathToFileURL(BOT_FILE).href);
}
function getOpenCode(){return openCode||(openCode=new OpenCodeController({stateDirectory:join(app.getPath('userData'),'opencode-sessions')}));}

if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',()=>{void app.whenReady().then(showHome)});

function publicState(){
 return {
  apps:Object.values(APPS).map(app=>({...app,status:{...states[app.id]},download:downloads().snapshot(app.id)})),
  release:{...release},
  storeVersion:app.getVersion(),automaticUpdates
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
 const productSession=session.fromPartition('persist:central-'+id);
 // Rewrite only the same-port loopback alias, before the request reaches DNS.
 // Other hosts/ports retain the normal navigation and authorization policy.
 productSession.webRequest.onBeforeRequest({urls:['http://localhost:'+port+'/*']},(details,callback)=>{
  const url=canonicalProductUrl(details.url,port);
  callback(url?{redirectURL:url}:{cancel:true});
 });
 const win=new BrowserWindow({
  width:1380,height:880,minWidth:780,minHeight:520,
  show:false,backgroundColor:'#101017',
  title:resolveApp(id).name+' · W1 Capital',
  webPreferences:{
   nodeIntegration:false,contextIsolation:true,sandbox:true,
   session:productSession
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
 if(id==='predictbot'){
  const bot=new BrowserWindow({width:1100,height:850,title:'PredictBot · W1 Capital',
   webPreferences:{preload:join(import.meta.dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  windows.set(id,bot);
  bot.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  bot.webContents.on('will-navigate',event=>event.preventDefault());
  bot.webContents.session.setPermissionRequestHandler((_sender,_permission,callback)=>callback(false));
  bot.on('closed',()=>{windows.delete(id);announce();});
  await bot.loadFile(BOT_FILE);setStatus(id,'running','PredictBot aberto no computador.');
  return publicState();
 }
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
  const catalog=await fetchReleaseCatalog();
  downloads().update(catalog);
  const candidate=selectProductRelease(catalog,BUILD.id);
  if(!candidate){release={...release,error:null,phase:'none',canDownload:false,available:false,checkedAt:new Date().toISOString()};return publicState();}
  const version=candidate.version,html=candidate.releaseUrl;
  const available=compareVersion(version,app.getVersion())>0;
  const asset=available?candidate:null;
  const preserved=available&&verifiedAsset?.version===version&&downloadedInstaller;
  if(!preserved){
   downloadedInstaller=null;
   verifiedAsset=asset;
  }
  release={version,notes:'Nova versão de '+BUILD.name+' disponível no GitHub.',
   url:html,checkedAt:new Date().toISOString(),error:null,available,
   canDownload:!!asset,phase:preserved?'downloaded':available?'available':'none',
   percent:preserved?100:0};
  if(!asset&&!preserved)verifiedAsset=null;
 }catch(error){
  release={...release,checkedAt:new Date().toISOString(),
   error:String(error?.message||'Não foi possível consultar versões.').slice(0,160)};
 }finally{checking=false;announce()}
 if(automaticUpdates&&release.available&&release.canDownload&&release.phase==='available')void downloadUpdate();
 return publicState();
}
async function installUpdate(automatic=false){
 if(installing||handingOffUpdate)return publicState();
 if(!downloadedInstaller||!verifiedAsset||release.phase!=='downloaded')
  throw Error('Nenhum instalador verificado está pronto.');
 if(process.platform!=='win32')throw Error('A atualização automática está disponível no Windows.');
 if(!automatic){
  const choice=await dialog.showMessageBox(storeWindow&&!storeWindow.isDestroyed()?storeWindow:undefined,{
   type:'question',title:'Atualizar '+BUILD.name,
   message:'A versão '+verifiedAsset.version+' está pronta para instalar.',
   detail:'A atualização substituirá os arquivos na instalação atual, no mesmo diretório. Todos os aplicativos abertos serão fechados e reabertos após a atualização.',
   buttons:['Atualizar e reiniciar','Depois'],defaultId:1,cancelId:1,noLink:true
  });
  if(choice.response!==0)return publicState();
 }
 installing=true;
 try{
  await verifyFileDigest(downloadedInstaller,verifiedAsset);
  const plan=createInPlaceUpdatePlan({
   installerPath:downloadedInstaller,executablePath:process.execPath,
   parentProcessId:process.pid,expectedSha256:verifiedAsset.sha256
  });
  const helper=app.isPackaged
   ?join(process.resourcesPath,'app.asar.unpacked','src','install-update.ps1')
   :join(import.meta.dirname,'install-update.ps1');
  if(!existsSync(helper))throw Error('Componente de atualização não encontrado.');
  const child=spawn('powershell.exe',[
   '-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',helper,...plan.helperArgs
  ],{detached:true,shell:false,stdio:'ignore',windowsHide:true});
  await new Promise((resolve,reject)=>{
   child.once('spawn',resolve);
   child.once('error',reject);
  });
  child.unref();
  handingOffUpdate=true;
  app.quit();
 }catch(error){
  handingOffUpdate=false;
  release={...release,phase:'error',error:String(error?.message||'A atualização não pôde ser iniciada.').slice(0,160)};
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
 downloadPromise=downloadVerifiedRelease({
  asset,folder:join(app.getPath('userData'),'trusted-updates'),
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
  title:BUILD.name+' · W1 Capital',
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
ipcMain.handle('central:download-product',(event,id)=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return downloads().download(id);
});
ipcMain.handle('central:show-download',async(event,id)=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 shell.showItemInFolder(await downloads().verifiedPath(id));return {shown:true};
});
ipcMain.handle('central:auto-updates',(event,enabled)=>{
 if(!trustedStoreEvent(event)||typeof enabled!=='boolean')throw Error('Solicitação inválida.');
 return setAutomaticUpdates(enabled);
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
ipcMain.handle('central:open-official-tool',async(event,provider)=>{
  if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
  const url=officialToolUrl(provider);
  await shell.openExternal(url);
  return {opened:true,provider};
});
ipcMain.handle('central:pick-opencode-files',async event=>{
  if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
  const result=await dialog.showOpenDialog({
   title:'Escolher arquivos para a tarefa OpenCode',
   buttonLabel:'Selecionar arquivos',
   properties:['openFile','multiSelections'],
   filters:ATTACHMENT_FILTERS
  });
  if(result.canceled)return [];
  if(result.filePaths.length>8)throw Error('Selecione no máximo 8 arquivos por tarefa.');
  return result.filePaths.map(path=>{
   const stat=lstatSync(path);
   if(!stat.isFile()||stat.isSymbolicLink())throw Error('Selecione arquivos normais, sem atalhos.');
   const info=classifyAttachment(path,stat.size);
   return {...info,path};
  });
});
ipcMain.handle('central:open-release',async event=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 if(!release.url||!release.available||!isSafeExternalUrl(release.url))return false;
 await shell.openExternal(release.url);
 return true;
});
ipcMain.handle('central:opencode',async(event,action,input={})=>{
 if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
 if(!input||typeof input!=='object'||JSON.stringify(input).length>50000)throw Error('Solicitação OpenCode inválida.');
 if(action==='simpleSetup'){
  const folder=join(app.getPath('documents'),'W1 Capital','Projetos');
  mkdirSync(folder,{recursive:true});
  const found=await getOpenCode().detect();
  return {installed:found.installed===true,executable:found.executable||'',
   directory:folder,userId:'windows-user-local',companyId:'w1-local-only',message:found.message||''};
 }
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
function showHome(){return BUILD.id==='lexispredict'||BUILD.id==='infinitum'?openProduct(BUILD.id):openStoreWindow();}
app.whenReady().then(()=>{
 try{const prefs=JSON.parse(readFileSync(join(app.getPath('userData'),'automatic-updates.json'),'utf8'));automaticUpdates=prefs.enabled!==false;}catch{}
 registerOpenCodeRelay({ipcMain,dialog,shell,controller:getOpenCode,isTrusted:trustedOpenCodeEvent});
 Menu.setApplicationMenu(BUILD.id==='central'?null:Menu.buildFromTemplate([{label:BUILD.name,submenu:[
  {label:'Verificar atualizações',click:async()=>{await checkUpdates();await dialog.showMessageBox({type:'info',title:BUILD.name,
   message:release.phase==='downloaded'?'Atualização verificada e pronta. Será aplicada ao fechar o aplicativo.':release.error||'As atualizações verificadas por SHA-256 são consultadas automaticamente.'});}},
  {label:'Atualizar automaticamente ao fechar',type:'checkbox',checked:automaticUpdates,click:item=>setAutomaticUpdates(item.checked)},
  {role:'quit',label:'Sair'}
 ]}]));
 void showHome();
 // Downloads are accepted only from official GitHub releases after SHA-256 validation.
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
app.on('window-all-closed',()=>{
 if(automaticUpdates&&release.phase==='downloading'&&downloadPromise){
  const pending=downloadPromise;
  void pending.then(()=>{
   if(automaticUpdates&&release.phase==='downloaded'&&!installing&&!handingOffUpdate)void installUpdate(true);
   else if(process.platform!=='darwin')app.quit();
  });
  return;
 }
 if(automaticUpdates&&release.phase==='downloaded'&&!installing&&!handingOffUpdate){void installUpdate(true);return;}
 if(process.platform!=='darwin')app.quit();
});
