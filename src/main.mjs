import {app,BrowserWindow,ipcMain,Menu,shell,dialog,session} from 'electron';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,dirname} from 'node:path';
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {classifyAttachment,ATTACHMENT_FILTERS} from './attachment-policy.mjs';
import {officialToolUrl} from './official-tools.mjs';
import {evaluateLingerCompatibility} from './linger-integration.mjs';
import {totalmem} from 'node:os';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {registerOpenCodeRelay,stopOpenCodeRelay} from './opencode-relay-ipc.mjs';
import {OpenCodeController} from './opencode-controller.mjs';
import {APPS,resolveApp} from './catalog.mjs';
import {reserveStablePort,safeEnvironment,isLocalUrl,isSafeExternalUrl,canonicalProductUrl} from './runtime-policy.mjs';
import {validateReleaseAsset,downloadVerifiedRelease,verifyFileDigest,verifyWindowsSignature} from './update-security.mjs';
import {createInPlaceUpdatePlan} from './update-install.mjs';
import {OPENCODE_RELEASES_API,chooseOpenCodeDesktopRelease,downloadVerifiedOpenCodeDesktop} from './opencode-desktop-update.mjs';
import {productSpec,fetchReleaseCatalog,selectProductRelease} from './distribution.mjs';
import {ProductDownloads} from './product-downloads.mjs';
import {productInstallation,planProductInstall,readProductRecord,writeProductRecord} from './installed-products.mjs';
import {LocalAIManager} from './local-ai-manager.mjs';
import {LocalPredictBotChat} from './predictbot-local.mjs';
import {PredictBotLibrary} from './predictbot-library.mjs';
import {zoomFactorForAction,zoomPercent} from './product-zoom.mjs';
import {singleFlight,loadProductWhenReady} from './product-startup.mjs';
import {waitForLocalHealth} from './local-health.mjs';
import {shouldAutoUpdateInstalledProduct} from './product-auto-update.mjs';
import {normalizeInstalledVersion,confirmInstalledVersion,canRetryInstall,sameRelease} from './install-verification.mjs';
const runExecutable=promisify(execFile);

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
const updateChecks=new Map();
let closing=false;
const installAttemptFile=join(app.getPath('userData'),'last-install-attempt.json');
function previousInstallAttempt(asset){
 try{return !canRetryInstall(JSON.parse(readFileSync(installAttemptFile,'utf8')),asset);}
 catch{return false;}
}
let openCode;
let openCodeDesktopRelease=null,openCodeDesktopTask=null;
let localAIManager;
let localPredictBot;
let predictBotLibrary;
let productDownloads;
const productInstallTasks=new Map();
const productAutomaticChecks=new Map();
const productOpenTasks=new Map();
const installedProductsFile=join(app.getPath('userData'),'installed-products.json');
const userLocalData=()=>process.env.LOCALAPPDATA||join(app.getPath('home'),'AppData','Local');
const productVersions=new Map();
async function installedExeVersion(path){
 if(process.platform!=='win32')return null;
 try{const {stdout}=await runExecutable('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Diagnostics.FileVersionInfo]::GetVersionInfo($env:W1_VERSION_EXE).ProductVersion'],{env:{...process.env,W1_VERSION_EXE:path},windowsHide:true,timeout:10000,maxBuffer:16384});return normalizeInstalledVersion(stdout)}catch{return null}
}
function installedProductState(id){
 const record=readProductRecord(installedProductsFile,id);
 const installed=productInstallation(id,{localAppData:userLocalData(),storedDirectory:record?.directory});
 return {installed:installed.installed,version:installed.installed?(productVersions.has(id)?productVersions.get(id):record?.version||null):null,phase:productInstallTasks.has(id)?'installing':installed.installed?'installed':'missing'};
}
function downloads(){return productDownloads||(productDownloads=new ProductDownloads({folder:join(app.getPath('downloads'),'W1 Capital'),onState:announce}));}
let automaticUpdates=true;
function setAutomaticUpdates(enabled){
 automaticUpdates=enabled;
 writeFileSync(join(app.getPath('userData'),'automatic-updates.json'),JSON.stringify({enabled}));
 announce();
 if(enabled)void checkUpdates();
 return publicState();
}
function trustedOpenCodeEvent(event){
 const bot=windows.get('predictbot');
 return trustedStoreEvent(event)||!!(bot&&!bot.isDestroyed()&&event.sender===bot.webContents&&event.senderFrame?.url===pathToFileURL(BOT_FILE).href);
}
function getOpenCode(){return openCode||(openCode=new OpenCodeController({stateDirectory:join(app.getPath('userData'),'opencode-sessions')}));}
function trustedPredictBotEvent(event){
 const bot=windows.get('predictbot');
 return (BUILD.id==='predictbot'&&trustedStoreEvent(event))||
  !!(bot&&!bot.isDestroyed()&&event.sender===bot.webContents&&
  event.senderFrame?.url===pathToFileURL(BOT_FILE).href);
}
function getPredictBotLibrary(){
 return predictBotLibrary||(predictBotLibrary=new PredictBotLibrary({directory:join(app.getPath('userData'),'predictbot-library')}));
}
function getLocalPredictBot(){
 return localPredictBot||(localPredictBot=new LocalPredictBotChat({
  file:join(app.getPath('userData'),'predictbot-local-history.json'),
  library:getPredictBotLibrary(),
  loadRuntime:async()=>{
   const manager=getLocalAI();
   const current=await manager.status();
   if(!current.running)await manager.prepare();
   const active=await manager.status(),credentials=await manager.openCodeEnvironment();
   if(!active.running||!active.endpoint||!credentials?.apiKey)
    throw Error('A IA local ainda não está pronta. Verifique a conexão e o espaço em disco.');
   return {endpoint:active.endpoint, key:credentials.apiKey,context:active.context||1024};
  }
 }));
}
function announceLocalAI(state){
 const targets=new Set([storeWindow,windows.get('predictbot')]);
 for(const target of targets)if(target&&!target.isDestroyed())target.webContents.send('central:local-ai-state',state);
}
function getLocalAI(){
 return localAIManager||(localAIManager=new LocalAIManager({
  rootDirectory:join(process.env.LOCALAPPDATA||app.getPath('appData'),'W1 Capital','Local AI'),
  configPath:join(app.getPath('userData'),'local-ai','opencode.json'),
  onProgress:announceLocalAI
 }));
}

if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',()=>{void app.whenReady().then(showHome)});

function publicState(){
 return {
  apps:Object.values(APPS).map(app=>({...app,status:{...states[app.id]},download:downloads().snapshot(app.id),installation:installedProductState(app.id)})),
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
 const name=resolveApp(id).name;
 const url='http://127.0.0.1:'+record.port+resolveApp(id).localHealth;
 try{
  await waitForLocalHealth({
   name,url,nonce:record.nonce,wait:sleep,
   alive:()=>!record.startupFailure&&record.child.exitCode===null&&record.child.signalCode===null,
   onProgress:attempt=>{
    if(attempt%20===0)setStatus(id,'starting','Iniciando servidor local de '+name+' ('+attempt+'/100)...');
   }
  });
 }catch(error){
  if(record.startupFailure){
   const code=String(record.startupFailure.code||'').replace(/[^A-Z_0-9]/g,'').slice(0,35);
   throw Error('O servidor local de '+name+' não iniciou'+(code?' ('+code+')':'')+'.');
  }
  if(record.startupHint)throw Error(String(error?.message||'Servidor local indisponível')+' '+record.startupHint);
  throw error;
 }
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
 const record={child,port,nonce,startupFailure:null,startupHint:null};
 // Registrar apenas códigos de falha Next, sem expor stderr ou segredos.
 child.stderr?.on('data',chunk=>{
  const value=String(chunk).slice(0,2048);
  const match=value.match(/\b(EADDRINUSE|EACCES|EPERM|ENOMEM|ENOENT|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND)\b/);
  if(match)record.startupHint='Diagnóstico local: '+match[1]+'.';
 });
 child.once('error',error=>{record.startupFailure=error;if(running.get(id)===record){
  running.delete(id);setStatus(id,'error','Falha ao iniciar servidor local.');}});
 child.once('exit',()=>{if(running.get(id)===record){
  running.delete(id);setStatus(id,'error','Servidor local encerrado.');}});
 running.set(id,record);
 try{await waitForProduct(id,record)}
 catch(error){if(child.exitCode===null)child.kill();running.delete(id);throw error}
 return record;
}
const ZOOM_SETTINGS_FILE='zoom-preferences.json';
function getProductZoom(id){
 try{
  const saved=JSON.parse(readFileSync(join(app.getPath('userData'),ZOOM_SETTINGS_FILE),'utf8'));
  const factor=saved?.[id];
  if(Number.isFinite(factor)&&factor>=.5&&factor<=2)return factor;
 }catch{}
 return 1;
}
function updateProductZoom(win,id,action){
 const factor=zoomFactorForAction(win.webContents.getZoomFactor(),action);
 win.webContents.setZoomFactor(factor);
 const path=join(app.getPath('userData'),ZOOM_SETTINGS_FILE);
 let settings={};
 try{
  const current=JSON.parse(readFileSync(path,'utf8'));
  if(current&&typeof current==='object'&&!Array.isArray(current))settings=current;
 }catch{}
 writeFileSync(path,JSON.stringify({...settings,[id]:factor}));
 return zoomPercent(factor);
}
async function updateFromMenu(){
 await checkUpdates();
 if(release.available&&release.canDownload){
  await downloadUpdate('background');
  if(release.phase==='downloaded'){await installUpdate();return;}
 }
 await dialog.showMessageBox({type:'info',title:BUILD.name,message:release.error||'Você já está na versão atual.'});
}
function attachLexisZoomMenu(win,id){
 if(id!=='lexispredict')return;
 const action=value=>updateProductZoom(win,id,value);
 win.setMenu(Menu.buildFromTemplate([
  {label:'Visualizar',submenu:[
   {label:'Aumentar zoom',accelerator:'CommandOrControl+Equal',click:()=>action('in')},
   {label:'Aumentar zoom (+)',accelerator:'CommandOrControl+Shift+Equal',click:()=>action('in')},
   {label:'Diminuir zoom',accelerator:'CommandOrControl+Minus',click:()=>action('out')},
   {label:'Restaurar 100%',accelerator:'CommandOrControl+0',click:()=>action('reset')},
  ]},
  {label:'Aplicativo',submenu:[
   {label:'Verificar atualizações',click:()=>void updateFromMenu()},
   {role:'quit',label:'Sair'}
  ]}
 ]));
 win.webContents.on('did-finish-load',()=>{
  if(!win.isDestroyed())win.webContents.setZoomFactor(getProductZoom(id));
 });
}

function inspectProductScreen(contents){
 // Não extrair textos ou dados de clientes: somente comprimento e falha visível.
 return contents.executeJavaScript(`(()=>{
   const text=(document.body?.innerText||'').trim();
   return {
     ready:document.readyState==='complete',
     visibleCharacters:text.length,
     fatal:/Application error:|Internal Server Error|ERR_CONNECTION_|This site can't be reached|500 Internal Server Error|404: This page could not be found/i.test(text.slice(0,500))
   };
 })()`,true);
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
 attachLexisZoomMenu(win,id);
 // Não mostrar uma tela preta antes da verificação do conteúdo real.
 win.on('closed',()=>{windows.delete(id);announce()});
 return win;
}
async function openProductInternal(id){
 resolveApp(id);
 const current=windows.get(id);
 if(current&&!current.isDestroyed()){current.show();current.focus();return publicState()}
 if(id==='predictbot'){
  const bot=new BrowserWindow({width:1100,height:850,show:false,backgroundColor:'#212121',
   title:'PredictBot · W1 Capital',
   webPreferences:{preload:join(import.meta.dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  windows.set(id,bot);
  bot.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  bot.webContents.on('will-navigate',event=>event.preventDefault());
  bot.webContents.session.setPermissionRequestHandler((_sender,_permission,callback)=>callback(false));
  bot.on('closed',()=>{if(windows.get(id)===bot)windows.delete(id);announce();});
  try{
   await loadProductWhenReady({
    navigate:()=>bot.loadFile(BOT_FILE),
    inspect:()=>inspectProductScreen(bot.webContents),
    isDestroyed:()=>bot.isDestroyed()||bot.webContents.isDestroyed(),
    onRetry:attempt=>setStatus(id,'starting','Recuperando a tela do PredictBot ('+attempt+'/2)...')
   });
   bot.show();bot.focus();
   setStatus(id,'running','PredictBot aberto no computador.');
  }catch(error){
   if(!bot.isDestroyed())bot.destroy();
   if(windows.get(id)===bot)windows.delete(id);
   setStatus(id,'error',error?.message||'O PredictBot não carregou.');
   await dialog.showMessageBox(storeWindow&&!storeWindow.isDestroyed()?storeWindow:undefined,{
    type:'error',title:'PredictBot · W1 Capital',
    message:'Não foi possível abrir o PredictBot.',
    detail:String(error?.message||'Erro de inicialização.').slice(0,300),buttons:['Entendi']
   });
  }
  return publicState();
 }
 setStatus(id,'starting','Preparando '+resolveApp(id).name+' no computador...');
 let win=null;
 try{
  const record=await startProduct(id);
  win=productBrowser(id,record.port);
  windows.set(id,win);
  const url='http://127.0.0.1:'+record.port+resolveApp(id).localEntry;
  await loadProductWhenReady({
   navigate:()=>win.loadURL(url),
   inspect:()=>inspectProductScreen(win.webContents),
   isDestroyed:()=>win.isDestroyed()||win.webContents.isDestroyed(),
   onRetry:attempt=>setStatus(id,'starting','Recuperando a tela do '+resolveApp(id).name+' automaticamente ('+attempt+'/2)...')
  });
  if(win.isDestroyed())throw Error('Janela encerrada durante a inicialização.');
  win.show();
  win.focus();
  setStatus(id,'running',resolveApp(id).name+' aberto no computador.');
 }catch(error){
  // Uma janela cujo loadURL falhou não pode permanecer no mapa de janelas.
  if(win&&!win.isDestroyed())win.destroy();
  if(windows.get(id)===win)windows.delete(id);
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
// Cinco cliques enquanto o Next inicia devem compartilhar a mesma tentativa.
function openProduct(id){
 resolveApp(id);
 return singleFlight(productOpenTasks,id,()=>openProductInternal(id));
}
function compareVersion(v1,v2){
 const norm=s=>String(s||'').replace(/^v/,'').split('.').map(Number);
 const a=norm(v1),b=norm(v2);
 if(a.length!==3||b.length!==3||[...a,...b].some(n=>!Number.isInteger(n)||n<0))return 0;
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]-b[i]}
 return 0;
}
function checkUpdates(){
 if(!app.isPackaged)return publicState();
 return singleFlight(updateChecks,'catalog',refreshUpdateCatalog);
}
async function refreshUpdateCatalog(){
 try{
  const catalog=await fetchReleaseCatalog();
  downloads().update(catalog);
  if(BUILD.id==='central'&&automaticUpdates)void singleFlight(productAutomaticChecks,'installed',updateInstalledProductsAutomatically)
   .catch(error=>console.warn('[central-auto-products]',String(error?.message||error).slice(0,180)));
  if(installing||handingOffUpdate)return publicState();
  // A versão validada mais nova pode ser uma preview aprovada no CI.
  const stable=selectProductRelease(catalog,BUILD.id);
  const candidate=automaticUpdates&&stable&&compareVersion(stable.version,app.getVersion())>0?stable:selectProductRelease(catalog,BUILD.id,{allowPreview:true});
  if(!candidate){release={...release,version:null,notes:'',url:null,error:null,phase:'none',canDownload:false,available:false,checkedAt:new Date().toISOString()};return publicState();}
  const version=candidate.version,html=candidate.releaseUrl;
  const available=compareVersion(version,app.getVersion())>0;
  const asset=available?candidate:null;
  const sameAsset=available&&verifiedAsset?.version===version&&verifiedAsset.sha256===asset.sha256;
  const downloading=sameAsset&&downloadPromise&&release.phase==='downloading';
  const downloaded=sameAsset&&downloadedInstaller&&release.phase==='downloaded';
  if(!sameAsset){
   downloadedInstaller=null;
   verifiedAsset=asset;
  }
  release={version,notes:'Nova versão de '+BUILD.name+' disponível no GitHub.',
   url:html,checkedAt:new Date().toISOString(),error:null,available,
   canDownload:!!asset,phase:downloading?'downloading':downloaded?'downloaded':available?'available':'none',
   percent:downloading?release.percent:downloaded?100:0};
  if(asset && previousInstallAttempt(asset) && !handingOffUpdate && !installing && !downloadPromise){
   release={...release,phase:'error',error:'A instalação anterior foi iniciada e esta versão continua aberta. Se o instalador já terminou, clique em Atualizar agora para tentar novamente.'};
  }
 }catch(error){
  release={...release,checkedAt:new Date().toISOString(),
   error:String(error?.message||'Não foi possível consultar versões.').slice(0,160)};
 }finally{announce()}
 if(automaticUpdates&&verifiedAsset?.preview!==true&&release.available&&release.canDownload&&release.phase==='available')void downloadUpdate();
 return publicState();
}
function signatureScript(){
 return app.isPackaged
  ?join(process.resourcesPath,'app.asar.unpacked','src','verify-signature.ps1')
  :join(import.meta.dirname,'verify-signature.ps1');
}
async function installUpdate(automatic=false){
 if(installing||handingOffUpdate)return publicState();
 if(automatic&&(verifiedAsset?.preview===true||!automaticUpdates))return publicState();
 if(!downloadedInstaller||!verifiedAsset||release.phase!=='downloaded')
  throw Error('Nenhum instalador verificado está pronto.');
 if(!app.isPackaged)throw Error('Atualizações automáticas estão disponíveis na versão instalada.');
 if(process.platform!=='win32')throw Error('A atualização automática está disponível no Windows.');
 installing=true;
 try{
 if(!automatic){
  const choice=await dialog.showMessageBox(storeWindow&&!storeWindow.isDestroyed()?storeWindow:undefined,{
   type:'question',title:'Atualizar '+BUILD.name,
   message:'A versão '+verifiedAsset.version+' está pronta para instalar.',
   detail:(verifiedAsset.preview?'Versão de teste sem Authenticode, verificada por SHA-256. Instalação manual somente. ':'')+'A atualização substituirá os arquivos na instalação atual, no mesmo diretório. O aplicativo será reaberto quando a instalação terminar.',
   buttons:['Atualizar e reiniciar','Depois'],defaultId:1,cancelId:1,noLink:true
  });
  if(choice.response!==0)return publicState();
 }
  await verifyFileDigest(downloadedInstaller,verifiedAsset);
  // Releases CI preview não têm certificado; URL oficial + SHA-256 já foram
  // conferidos duas vezes. Releases estáveis assinadas continuam com Authenticode.
  if(verifiedAsset.preview!==true)
   await verifyWindowsSignature(downloadedInstaller,signatureScript());
  const plan=createInPlaceUpdatePlan({
   installerPath:downloadedInstaller,executablePath:process.execPath,
  });
  // NSIS requires /D= to be the final, unquoted remainder, including any spaces.
  const launch=async(command,args)=>{
   const child=spawn(command,args,{
    argv0:'"'+command+'"',cwd:dirname(downloadedInstaller),windowsVerbatimArguments:true,
    detached:true,shell:false,stdio:'ignore',windowsHide:true
   });
   await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
   child.unref();
  };
  try{
   await launch(downloadedInstaller,plan.nsisArguments);
  }catch(error){
   if(!['EACCES','EPERM','UNKNOWN'].includes(error.code))throw error;
   // NSIS ships this helper for installations requiring Windows elevation.
   await launch(join(process.resourcesPath,'elevate.exe'),['"'+downloadedInstaller+'"',...plan.nsisArguments]);
  }
  // Persist the anti-loop marker only after the installer has spawned.
  handingOffUpdate=true;
  try{writeFileSync(installAttemptFile,JSON.stringify({version:verifiedAsset.version,sha256:verifiedAsset.sha256,startedAt:Date.now()}))}catch{/* installer already spawned; do not leave the running app blocking NSIS */}
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
  signatureScript:signatureScript(),
  onProgress:percent=>{
   if(release.version===asset.version){
    release={...release,phase:'downloading',percent};
    announce();
   }
  }
 }).then(async path=>{
  if(verifiedAsset?.sha256!==asset.sha256||verifiedAsset?.version!==asset.version||release.version!==asset.version)
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
async function openInstalledProduct(id){
 const candidate=productInstallation(id,{localAppData:userLocalData(),storedDirectory:readProductRecord(installedProductsFile,id)?.directory});
 if(!candidate.installed)throw Error('O aplicativo independente ainda não está instalado. Use Instalar ou atualizar e abrir.');
 const error=await shell.openPath(candidate.exe);
 if(error){
  // A loja nunca pode deixar o usuário sem acesso porque um EXE individual
  // antigo falhou: tente a edição integrada da Central, com a mesma base.
  // Confirmar estado "running" evita reportar sucesso com tela vazia.
  if(BUILD.id==='central'){
   const recovery=await openProduct(id);
   const status=recovery?.apps?.find(app=>app.id===id)?.status;
   if(status?.phase==='running')
    return {opened:true,recovered:true,mode:'integrated',installation:installedProductState(id)};
  }
  throw Error('O Windows não conseguiu abrir '+resolveApp(id).name+': '+String(error).slice(0,160));
 }
 return {opened:true,recovered:false,mode:'standalone',installation:installedProductState(id)};
}
async function installProductWithVerification(id,automatic=false){
 const spec=productSpec(id);
 if(!['lexispredict','infinitum','predictbot'].includes(id))throw Error('Aplicativo independente não autorizado.');
 const record=readProductRecord(installedProductsFile,id);
 const candidate=productInstallation(id,{localAppData:userLocalData(),storedDirectory:record?.directory});
 const selected=downloads().snapshot(id);
 const currentVersion=candidate.installed?await installedExeVersion(candidate.exe):null;
 productVersions.set(id,currentVersion);
 if(!selected.version)throw Error('Nenhuma versão independente publicada. Verifique as versões na Central.');
 if(currentVersion&&compareVersion(selected.version,currentVersion)<0)throw Error('A versão publicada é anterior à instalada; downgrade bloqueado.');
 if(automatic){
  if(!shouldAutoUpdateInstalledProduct({enabled:automaticUpdates,installed:candidate.installed,installedVersion:currentVersion,candidateVersion:selected.version,running:false,preview:selected.preview}))throw Error('Atualização automática não autorizada para a versão instalada ou o canal selecionado.');
 }else{
  const choice=await dialog.showMessageBox(storeWindow&&!storeWindow.isDestroyed()?storeWindow:undefined,{
   type:'question',title:'W1 Capital · '+spec.name,
   message:(candidate.installed?'Atualizar':'Instalar')+' '+spec.name+' v'+selected.version+' e abrir?',
   detail:(selected.preview?'Versão de teste sem Authenticode, verificada por SHA-256. ':'')+'O arquivo será baixado da release W1, conferido por SHA-256 e instalado na mesma pasta. Seus projetos e dados são preservados.',
   buttons:['Instalar e abrir','Cancelar'],defaultId:0,cancelId:1,noLink:true
  });
  if(choice.response!==0)return {cancelled:true};
 }
 if(downloads().snapshot(id).phase!=='downloaded')await downloads().download(id);
 const verified=await downloads().verifiedPackage(id);
 if(!sameRelease(selected,verified.asset))throw Error('A versão disponível mudou. Confira a nova release antes de instalar.');
 const installer=verified.path;
 if(selected.preview!==true)await verifyWindowsSignature(installer,signatureScript());
 if(automatic&&(!automaticUpdates||await isProductRunningInWindows(id)))throw Error('Atualização adiada: aplicativo em uso ou atualização automática desativada.');
 const plan=planProductInstall(id,{localAppData:userLocalData(),storedDirectory:record?.directory,installerPath:installer});
 const exitCode=await new Promise((resolve,reject)=>{
  let done=false;
  const child=spawn(installer,plan.args,{
   cwd:dirname(installer),windowsVerbatimArguments:true,argv0:'"'+installer+'"',
   windowsHide:true,shell:false,stdio:'ignore'
  });
  const timer=setTimeout(()=>{
   if(done)return;done=true;
   try{child.kill()}catch{}
   reject(Error('O instalador excedeu 10 minutos. O estado da instalação não foi confirmado; confira antes de repetir.'));
  },600000);
  const finish=(error,code)=>{
   if(done)return;done=true;clearTimeout(timer);
   if(error)reject(error);else resolve(code);
  };
  child.once('error',error=>finish(error));
  child.once('exit',(code,signal)=>finish(signal?Error('Instalador interrompido: '+signal):null,code));
 });
 if(exitCode!==0)throw Error(exitCode===2?
  'Código 2 ao atualizar '+spec.name+': o executável da instalação anterior ainda pode estar em uso ou a substituição falhou. A versão antiga foi preservada.':
  'O instalador de '+spec.name+' encerrou com código '+exitCode+'. A instalação anterior foi preservada.');
 const updated=productInstallation(id,{localAppData:userLocalData(),storedDirectory:plan.directory});
 if(!updated.installed)throw Error('A instalação terminou sem criar '+spec.name+'.exe na pasta esperada. O programa antigo não foi removido.');
 const actual=await installedExeVersion(updated.exe);
 productVersions.set(id,actual);
 confirmInstalledVersion(actual,selected.version);
 writeProductRecord(installedProductsFile,id,actual,plan.directory);
 announce();
 if(automatic)return {installed:true,opened:false,version:selected.version,updatedInPlace:true};
 const opened=await openInstalledProduct(id);
 return {installed:true,opened:opened.opened,version:selected.version};
}
// Check a product's process before replacing its installed binary. Never
// interrupt a running CRM or launch an application in the background.
async function isProductRunningInWindows(id){
 if(process.platform!=='win32')return true;
 const image=productSpec(id).name+'.exe';
 try{
  const {stdout}=await runExecutable('tasklist.exe',
   ['/FI','IMAGENAME eq '+image,'/FO','CSV','/NH'],
   {windowsHide:true,timeout:7000,maxBuffer:64000});
  return stdout.split(/\r?\n/).some(line=>line.trim().toLowerCase().startsWith('"'+image.toLowerCase()+'",'));
 }catch{return true;} // Could not check whether it is running: do not overwrite.
}
async function updateInstalledProductsAutomatically(){
 if(BUILD.id!=='central'||process.platform!=='win32'||!automaticUpdates||!app.isPackaged)return;
 for(const id of ['lexispredict','infinitum','predictbot']){
  if(!automaticUpdates||installing||handingOffUpdate)return;
  if(productInstallTasks.has(id))continue;
  const previous=installedProductState(id);
  const installation=productInstallation(id,{localAppData:userLocalData(),storedDirectory:readProductRecord(installedProductsFile,id)?.directory});
  if(!installation.installed)continue;
  const actual=await installedExeVersion(installation.exe);productVersions.set(id,actual);
  const candidate=downloads().snapshot(id);
  if(!shouldAutoUpdateInstalledProduct({
   enabled:automaticUpdates,installed:previous.installed,
   installedVersion:actual,candidateVersion:candidate.version,running:false,preview:candidate.preview
  }))continue;
  const running=await isProductRunningInWindows(id);
  if(running||productInstallTasks.has(id)||!automaticUpdates)continue;
  const task=installProductWithVerification(id,true);
  productInstallTasks.set(id,task);announce();
  try{await task;}
  catch(error){
   // Preserve existing EXE and previous version marker on failed download/install.
   console.warn('[central-auto-product] '+id+': '+String(error?.message||error).slice(0,160));
  }finally{productInstallTasks.delete(id);announce();}
 }
}
ipcMain.handle('central:install-product',async(event,id)=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 if(process.platform!=='win32')throw Error('Este instalador é compatível somente com Windows.');
 productSpec(id);
 if(productInstallTasks.has(id))throw Error('A instalação deste aplicativo já está em andamento.');
 const task=installProductWithVerification(id);
 productInstallTasks.set(id,task);announce();
 try{return await task}finally{productInstallTasks.delete(id);announce()}
});
ipcMain.handle('central:open-installed-product',async(event,id)=>{
 if(!trustedStoreEvent(event))throw Error('Origem não autorizada.');
 return openInstalledProduct(id);
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
 const state=await openProduct(id);
 const current=state.apps.find(app=>app.id===id);
 if(current?.status?.phase==='error')throw Error(current.status.message||'Falha ao iniciar produto local.');
 return state;
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
ipcMain.handle('central:linger-capability',event=>{
 if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
 return evaluateLingerCompatibility({platform:process.platform,arch:process.arch,totalMemory:totalmem()});
});
ipcMain.handle('central:open-official-tool',async(event,provider)=>{
  if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
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
ipcMain.handle('central:local-ai',async(event,action)=>{
 if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
 const manager=getLocalAI();
 if(action==='status')return manager.status();
 if(action==='prepare')return manager.prepare();
 throw Error('Operação de IA local não autorizada.');
});
// The OpenCode desktop maintains its own electron-updater. W1 never overrides
// that updater; this opt-in verified installer is a recovery path if it gets stuck.
ipcMain.handle('central:opencode-desktop-update',async(event,action)=>{
 if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
 if(process.platform!=='win32')throw Error('Instalador oficial disponível apenas para Windows.');
 if(!['check','repair'].includes(action))throw Error('Ação de atualização OpenCode inválida.');
 if(action==='check'){
  const response=await fetch(OPENCODE_RELEASES_API,{
   headers:{Accept:'application/vnd.github+json','User-Agent':'W1-Central-OpenCode-Update'},
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error('Não foi possível consultar as releases oficiais do OpenCode (HTTP '+response.status+').');
  const length=Number(response.headers?.get?.('content-length'))||0;
  if(length>3_000_000)throw Error('Catálogo do OpenCode muito grande.');
  const releases=await response.json();
  const latest=chooseOpenCodeDesktopRelease(releases);
  if(!latest)throw Error('Nenhum instalador estável x64 com SHA-256 foi publicado pelo OpenCode.');
  openCodeDesktopRelease=latest;
  return {version:latest.version,releaseUrl:latest.releaseUrl,downloadBytes:latest.size,nativeUpdater:true};
 }
 if(openCodeDesktopTask)return openCodeDesktopTask;
 const task=(async()=>{
  // We intentionally ask before launching an independent vendor installer.
  const latest=openCodeDesktopRelease||await (async()=>{
   const response=await fetch(OPENCODE_RELEASES_API,{
    headers:{Accept:'application/vnd.github+json','User-Agent':'W1-Central-OpenCode-Update'},
    cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)
   });
   if(!response.ok)throw Error('Não foi possível consultar a versão oficial do OpenCode.');
   const found=chooseOpenCodeDesktopRelease(await response.json());
   if(!found)throw Error('Nenhum instalador OpenCode verificado está disponível.');
   return found;
  })();
  const choice=await dialog.showMessageBox({
   type:'question',title:'OpenCode · W1 Capital',
   message:'Abrir o instalador oficial do OpenCode v'+latest.version+'?',
   detail:'Esta é uma opção de reparo quando a atualização do OpenCode fica presa. O instalador vem do GitHub do desenvolvedor e terá SHA-256 conferido. Feche o OpenCode antes de confirmar a instalação. Nenhum dado ou projeto será apagado.',
   buttons:['Baixar e abrir instalador','Cancelar'],defaultId:1,cancelId:1,noLink:true
  });
  if(choice.response!==0)return {cancelled:true};
  const folder=join(app.getPath('userData'),'trusted-opencode-updates');
  let lastPercent=-1;
  const path=await downloadVerifiedOpenCodeDesktop({asset:latest,folder,onProgress:percent=>{
   if(percent===lastPercent)return;
   lastPercent=percent;
   for(const win of new Set([storeWindow,windows.get('predictbot')]))
    if(win&&!win.isDestroyed())win.webContents.send('central:opencode-desktop-update-progress',percent);
  }});
  const result=await shell.openPath(path);
  if(result)throw Error('O Windows não abriu o instalador do OpenCode: '+String(result).slice(0,120));
  return {launched:true,version:latest.version};
 })().finally(()=>{openCodeDesktopTask=null});
 openCodeDesktopTask=task;
 return task;
});
ipcMain.handle('central:predictbot-files',async(event,action,input={})=>{
 if(!trustedPredictBotEvent(event))throw Error('Origem não autorizada.');
 const library=getPredictBotLibrary();
 if(action==='list')return library.list();
 if(action==='remove')return library.remove(input.id);
 if(action==='pick'){
  const result=await dialog.showOpenDialog({
   title:'Adicionar arquivos à biblioteca do PredictBot',
   properties:['openFile','multiSelections'],filters:ATTACHMENT_FILTERS
  });
  if(result.canceled)return [];
  return library.add(result.filePaths);
 }
 throw Error('Operação de arquivos inválida.');
});
ipcMain.handle('central:opencode',async(event,action,input={})=>{
 if(!trustedOpenCodeEvent(event))throw Error('Origem não autorizada.');
 if(!input||typeof input!=='object'||JSON.stringify(input).length>50000)throw Error('Solicitação OpenCode inválida.');
 // PredictBot abre diretamente em conversa. A instalação do modelo é feita
 // no computador local; nenhuma senha ou URL vai para a interface.
 if(trustedPredictBotEvent(event)&&action==='autoStart'){
  if(process.env.W1_DESKTOP_SMOKE_TEST==='1')
   return {connected:false,message:'Teste visual sem baixar modelos de IA.'};
  return getLocalPredictBot().start();
 }
 if(trustedPredictBotEvent(event)&&['sessions','create','messages','prompt','models','skills','setSkill','setModel'].includes(action))
  return getLocalPredictBot().act(action,input);
 if(action==='pickExecutable'){
  const result=await dialog.showOpenDialog({title:'Escolher a CLI do OpenCode',properties:['openFile'],filters:[{name:'Executável do OpenCode',extensions:['exe']}]});
  return result.canceled?'':result.filePaths[0];
 }
 if(action==='officialDownload'){
  await shell.openExternal(officialToolUrl('opencode'));
  return;
 }
 if(action==='simpleSetup'){
  const folder=join(app.getPath('documents'),'W1 Capital','Projetos');
  mkdirSync(folder,{recursive:true});
  const found=await getOpenCode().detect(input.executable);
  return {installed:found.installed===true,executable:found.executable||'',
   directory:folder,userId:'windows-user-local',companyId:'w1-local-only',message:found.message||''};
 }
 if(action==='detect')return getOpenCode().detect(input.executable);
 if(action==='connect'){
  stopOpenCodeRelay();
  const safeInput={...input};delete safeInput.localAI;
  const managedLocalAI=safeInput.mode==='local'?await getLocalAI().openCodeEnvironment():null;
  return getOpenCode().connect({...safeInput,...(managedLocalAI?{localAI:managedLocalAI}:{})});
 }
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
  {label:'Verificar atualizações',click:()=>void updateFromMenu()},
  {label:'Atualizar automaticamente ao fechar',type:'checkbox',checked:automaticUpdates,click:item=>setAutomaticUpdates(item.checked)},
  {role:'quit',label:'Sair'}
 ]}]));
 void showHome();
 // Downloads are accepted only from official GitHub releases after SHA-256 validation.
 void checkUpdates();
 const timer=setInterval(()=>void checkUpdates(),30*60*1000);
 timer.unref?.();
}).catch(()=>app.quit());
app.on('before-quit',event=>{
 // A menu "Sair" goes directly through before-quit, not window-all-closed.
 // Do not silently discard an already verified automatic update.
 if(!closing&&automaticUpdates&&release.phase==='downloaded'&&!installing&&!handingOffUpdate){
  event.preventDefault();
  void installUpdate(true).then(()=>{if(!handingOffUpdate)app.quit()});
  return;
 }
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
   if(automaticUpdates&&release.phase==='downloaded'&&!installing&&!handingOffUpdate){
    void installUpdate(true).then(()=>{
     if(!handingOffUpdate&&process.platform!=='darwin')app.quit();
    });
   }else if(process.platform!=='darwin')app.quit();
  });
  return;
 }
 if(automaticUpdates&&release.phase==='downloaded'&&!installing&&!handingOffUpdate){
  void installUpdate(true).then(()=>{
   if(!handingOffUpdate&&process.platform!=='darwin')app.quit();
  });
  return;
 }
 if(process.platform!=='darwin')app.quit();
});
