import {createHash,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {access,mkdir,open,readFile,rename,rm,stat,writeFile,readdir} from 'node:fs/promises';
import {Transform,Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {cpus,totalmem} from 'node:os';
import {dirname,join,isAbsolute,win32} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {
 LOCAL_AI_ENGINE,LOCAL_AI_MODEL,selectLocalAIProfile,
 createLocalAIProviderConfig,createLlamaServerArgs,validateAssetRedirect
} from './local-ai-policy.mjs';

const KEY_PATTERN=/^[a-f0-9]{64}$/i;
const PORT_START=8765,PORT_END=8785;

async function exists(path){try{await access(path);return true}catch{return false}}
async function sha256File(path){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(path))hash.update(chunk);
 return hash.digest('hex');
}
async function findFile(root,name,depth=0){
 if(depth>5)return null;
 let entries;try{entries=await readdir(root,{withFileTypes:true})}catch{return null}
 for(const entry of entries){
  if(entry.isFile()&&entry.name.toLowerCase()===name.toLowerCase())return join(root,entry.name);
 }
 for(const entry of entries){
  if(!entry.isDirectory())continue;
  const found=await findFile(join(root,entry.name),name,depth+1);
  if(found)return found;
 }
 return null;
}
function runProcess(command,args,options,spawnImpl){
 return new Promise((resolve,reject)=>{
  let child;
  try{child=spawnImpl(command,args,options)}catch(error){reject(error);return}
  child.once('error',reject);
  child.once('exit',(code,signal)=>{
   if(code===0)resolve();
   else reject(Error('Processo de instalação terminou com código '+String(code??signal??'desconhecido')+'.'));
  });
 });
}
async function portAvailable(port){
 const server=createServer();
 return new Promise(resolve=>{
  server.once('error',()=>resolve(false));
  server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));
 });
}

export async function downloadVerifiedAsset({asset,destination,assetType,fetchImpl=fetch,onProgress=()=>{},timeoutMs=60*60*1000}={}){
 if(!asset||typeof asset.url!=='string'||!/^[a-f0-9]{64}$/i.test(String(asset.sha256||'')))throw Error('Manifesto de download inválido.');
 if(typeof destination!=='string'||!(isAbsolute(destination)||win32.isAbsolute(destination)))throw Error('Destino absoluto obrigatório.');
 if(!Number.isSafeInteger(asset.maxBytes)||asset.maxBytes<1||asset.maxBytes>2_000_000_000)throw Error('Limite de download inválido.');
 validateAssetRedirect(asset.url,assetType);
 const temporary=destination+'.'+process.pid+'.'+randomBytes(6).toString('hex')+'.part';
 let received=0;
 try{
  await mkdir(dirname(destination),{recursive:true});
  const response=await fetchImpl(asset.url,{redirect:'follow',cache:'no-store',headers:{'User-Agent':'W1-Capital-Local-AI'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response?.ok||!response.body)throw Error('Download oficial respondeu HTTP '+String(response?.status||0)+'.');
  validateAssetRedirect(response.url||asset.url,assetType);
  const totalBytes=Number(response.headers?.get?.('content-length'))||asset.size||0;
  if(totalBytes>asset.maxBytes||(asset.size&&totalBytes&&totalBytes!==asset.size))throw Error('Download excedeu o tamanho permitido.');
  const hash=createHash('sha256');
  const meter=new Transform({
   transform(chunk,encoding,callback){
    received+=chunk.length;
    if(received>asset.maxBytes){callback(Error('Download excedeu o limite de tamanho permitido.'));return}
    hash.update(chunk);
    try{onProgress({receivedBytes:received,totalBytes,percent:totalBytes?Math.min(99,received/totalBytes*100):0})}catch{}
    callback(null,chunk);
   }
  });
  await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(temporary,{flags:'wx'}));
  const actual=hash.digest('hex');
  if(asset.size&&received!==asset.size)throw Error('Tamanho do arquivo não corresponde ao manifesto oficial.');
  if(actual.toLowerCase()!==asset.sha256.toLowerCase())throw Error('SHA-256 do download não corresponde ao manifesto oficial.');
  await rename(temporary,destination);
  return {destination,sha256:actual,bytes:received};
 }catch(error){
  await rm(temporary,{force:true}).catch(()=>{});
  throw error;
 }
}

export class LocalAIManager{
 #root;#configPath;#fetch;#spawn;#hardware;#onProgress;#preparePromise;#lastStatus;#ready;#child;#waitAttempts;#waitIntervalMs;
 constructor({rootDirectory,configPath,fetchImpl=fetch,spawnImpl=spawn,platform=process.platform,arch=process.arch,totalMemory=totalmem(),logicalCores=cpus().length,onProgress=()=>{},waitAttempts=300,waitIntervalMs=1000}={}){
  if(typeof rootDirectory!=='string'||!(isAbsolute(rootDirectory)||win32.isAbsolute(rootDirectory)))throw Error('Diretório local da IA deve ser absoluto.');
  if(typeof configPath!=='string'||!(isAbsolute(configPath)||win32.isAbsolute(configPath)))throw Error('Configuração OpenCode da IA deve ter caminho absoluto.');
  this.#root=rootDirectory;this.#configPath=configPath;this.#fetch=fetchImpl;this.#spawn=spawnImpl;
  this.#hardware={platform,arch,totalMemory,logicalCores};this.#onProgress=onProgress;
  this.#waitAttempts=waitAttempts;this.#waitIntervalMs=waitIntervalMs;
 }
 #paths(){
  return {
   key:join(this.#root,'server.key'),
   state:join(this.#root,'runtime.json'),
   engineZip:join(this.#root,'downloads',LOCAL_AI_ENGINE.fileName),
   engineDir:join(this.#root,'runtime',LOCAL_AI_ENGINE.version),
   model:join(this.#root,'models',LOCAL_AI_MODEL.revision,LOCAL_AI_MODEL.fileName)
  };
 }
 #emit(value){
  this.#lastStatus={...value,updatedAt:new Date().toISOString()};
  try{this.#onProgress({...this.#lastStatus})}catch{}
  return this.#lastStatus;
 }
 async #acquireLock(){
  const lockPath=join(this.#root,'setup.lock');
  await mkdir(this.#root,{recursive:true});
  for(let attempt=0;attempt<3600;attempt++){
   try{
    const handle=await open(lockPath,'wx',0o600);
    await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:Date.now()}));
    return async()=>{await handle.close().catch(()=>{});await rm(lockPath,{force:true}).catch(()=>{})};
   }catch(error){
    if(error.code!=='EEXIST')throw error;
    let stale=false;
    try{
     const value=JSON.parse(await readFile(lockPath,'utf8'));
     const pid=Number(value.pid);
     if(!Number.isInteger(pid)||pid<1)stale=Date.now()-Number(value.startedAt||0)>60000;
     else try{process.kill(pid,0)}catch(check){if(check.code==='ESRCH'||check.code==='EINVAL')stale=true}
    }catch{stale=true}
    if(stale){await rm(lockPath,{force:true}).catch(()=>{});continue}
    if(attempt===0)this.#emit({phase:'checking',supported:true,percent:0,message:'Outra janela W1 está preparando a IA local. A instalação será compartilhada.'});
    await delay(1000);
   }
  }
  throw Error('A preparação local já está em andamento em outra janela W1. Tente novamente em instantes.');
 }
 async #readKey(){
  try{const key=(await readFile(this.#paths().key,'utf8')).trim();return KEY_PATTERN.test(key)?key:null}catch{return null}
 }
 async #ensureKey(){
  const paths=this.#paths();await mkdir(this.#root,{recursive:true});
  const existing=await this.#readKey();if(existing)return existing;
  await rm(paths.key,{force:true}).catch(()=>{});
  const key=randomBytes(32).toString('hex');
  try{await writeFile(paths.key,key+'\n',{flag:'wx',mode:0o600});return key}
  catch(error){if(error.code!=='EEXIST')throw error;const raced=await this.#readKey();if(raced)return raced;throw Error('Não foi possível criar a chave local protegida.')}
 }
 async #readState(){
  try{
   const value=JSON.parse(await readFile(this.#paths().state,'utf8'));
   if(value?.version===1&&Number.isInteger(value.port)&&value.port>=PORT_START&&value.port<=PORT_END)return value;
  }catch{}
  return null;
 }
 async #writeState(value){
  const path=this.#paths().state,temp=path+'.'+process.pid+'.tmp';
  await mkdir(dirname(path),{recursive:true});
  await writeFile(temp,JSON.stringify({version:1,...value})+'\n',{mode:0o600});
  await rename(temp,path);
 }
 async #ensureAsset(asset,destination,assetType,phase,message){
  if(await exists(destination)){
   try{if((await sha256File(destination)).toLowerCase()===asset.sha256.toLowerCase())return destination}catch{}
   await rm(destination,{force:true});
  }
  this.#emit({phase,percent:0,receivedBytes:0,totalBytes:0,message});
  await downloadVerifiedAsset({
   asset,destination,assetType,fetchImpl:this.#fetch,
   onProgress:value=>this.#emit({phase,message,...value})
  });
  this.#emit({phase,percent:100,message,receivedBytes:0,totalBytes:0});
  return destination;
 }
 async #extractEngine(zipPath){
  const paths=this.#paths(),parent=dirname(paths.engineDir);
  await mkdir(parent,{recursive:true});
  const temporary=join(parent,'.extract-'+process.pid+'-'+randomBytes(5).toString('hex'));
  await mkdir(temporary,{recursive:true});
  try{
   const script='Expand-Archive -LiteralPath $env:W1_LOCAL_AI_ARCHIVE -DestinationPath $env:W1_LOCAL_AI_DESTINATION -Force';
   await runProcess('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{
    cwd:parent,windowsHide:true,shell:false,stdio:'ignore',
    env:{...process.env,W1_LOCAL_AI_ARCHIVE:zipPath,W1_LOCAL_AI_DESTINATION:temporary}
   },this.#spawn);
   const extracted=await findFile(temporary,'llama-server.exe');
   if(!extracted)throw Error('O pacote oficial não contém llama-server.exe.');
   await rm(paths.engineDir,{recursive:true,force:true});
   await rename(temporary,paths.engineDir);
   const result=await findFile(paths.engineDir,'llama-server.exe');
   if(!result)throw Error('Não foi possível localizar o motor CPU após a instalação.');
   return result;
  }catch(error){await rm(temporary,{recursive:true,force:true}).catch(()=>{});throw error}
 }
 async #ensureEngine(){
  const paths=this.#paths();
  const existing=await findFile(paths.engineDir,'llama-server.exe');
  if(existing)return existing;
  const zip=await this.#ensureAsset({...LOCAL_AI_ENGINE,maxBytes:50_000_000},paths.engineZip,'engine','downloading-engine','Baixando o motor CPU verificado do llama.cpp.');
  this.#emit({phase:'extracting-engine',percent:0,message:'Preparando o motor local no computador.'});
  return this.#extractEngine(zip);
 }
 async #ensureModel(){
  const paths=this.#paths();
  return this.#ensureAsset({...LOCAL_AI_MODEL,maxBytes:1_300_000_000},paths.model,'model','downloading-model','Baixando o modelo oficial Microsoft BitNet (aproximadamente 1,19 GB).');
 }
 async #isReady(port,key){
  try{
   const response=await this.#fetch('http://127.0.0.1:'+port+'/v1/models',{
    headers:{Authorization:'Bearer '+key,Accept:'application/json'},
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(1500)
   });
   if(!response.ok)return false;
   const value=await response.json();
   return Array.isArray(value?.data)&&value.data.some(model=>model?.id==='w1-bitnet-2b');
  }catch{return false}
 }
 async #findExistingServer(key){
  const state=await this.#readState();
  const ports=[state?.port,...Array.from({length:PORT_END-PORT_START+1},(_,i)=>PORT_START+i)].filter(Number.isInteger);
  for(const port of new Set(ports))if(await this.#isReady(port,key))return port;
  return null;
 }
 async #choosePort(){
  for(let port=PORT_START;port<=PORT_END;port++)if(await portAvailable(port))return port;
  throw Error('As portas locais reservadas para a IA estão ocupadas.');
 }
 async #waitReady(port,key,child){
  let failure=null;
  child?.once('error',error=>{failure=error});
  for(let attempt=0;attempt<this.#waitAttempts;attempt++){
   if(failure)throw Error('O motor local não pôde iniciar: '+String(failure.message||'falha ao abrir executável').slice(0,100));
   if(child&&(child.exitCode!==null||child.signalCode!==null))throw Error('O motor local encerrou durante a inicialização.');
   if(await this.#isReady(port,key))return;
   await delay(this.#waitIntervalMs);
  }
  throw Error('O motor local não respondeu após carregar o modelo. Verifique memória e compatibilidade do processador.');
 }
 async #startServer(executable,modelPath,keyPath,key,profile){
  const existing=await this.#findExistingServer(key);
  if(existing)return existing;
  const port=await this.#choosePort();
  this.#emit({phase:'starting',percent:0,message:'Carregando BitNet na memória do computador.'});
  const args=createLlamaServerArgs({modelPath,keyPath,port,threads:profile.threads,context:profile.context});
  const child=this.#spawn(executable,args,{
   cwd:dirname(executable),detached:true,windowsHide:true,shell:false,stdio:'ignore',
   env:{...process.env,OMP_NUM_THREADS:String(profile.threads),LLAMA_ARG_N_GPU_LAYERS:'0'}
  });
  this.#child=child;
  child.unref?.();
  await this.#waitReady(port,key,child);
  return port;
 }
 async #writeOpenCodeConfig(port){
  await mkdir(dirname(this.#configPath),{recursive:true});
  const temporary=this.#configPath+'.'+process.pid+'.tmp';
  await writeFile(temporary,JSON.stringify(createLocalAIProviderConfig({port}),null,2)+'\n',{mode:0o600});
  await rename(temporary,this.#configPath);
 }
 async prepare(){
  if(this.#preparePromise)return this.#preparePromise;
  this.#preparePromise=this.#prepare().finally(()=>{this.#preparePromise=null});
  return this.#preparePromise;
 }
 async #prepare(){
  const release=await this.#acquireLock();
  try{return await this.#prepareUnlocked()}finally{await release()}
 }
 async #prepareUnlocked(){
  const profile=selectLocalAIProfile(this.#hardware);
  if(!profile.supported){this.#emit({phase:'unsupported',supported:false,percent:0,message:profile.reason});throw Error(profile.reason)}
  this.#emit({phase:'checking',supported:true,percent:0,message:'Verificando os componentes e a memória disponível.'});
  await mkdir(this.#root,{recursive:true});
  const key=await this.#ensureKey();
  const existing=await this.#findExistingServer(key);
  if(existing){
   await this.#writeOpenCodeConfig(existing);
   await this.#writeState({port:existing,engineVersion:LOCAL_AI_ENGINE.version,modelRevision:LOCAL_AI_MODEL.revision});
   this.#ready={port:existing,key,configPath:this.#configPath};
   this.#emit({phase:'ready',supported:true,running:true,installed:true,percent:100,port:existing,endpoint:'http://127.0.0.1:'+existing+'/v1',model:LOCAL_AI_MODEL.name,message:'IA local já estava em execução e foi reutilizada pelas janelas W1.'});
   return {...this.#lastStatus};
  }
  const executable=await this.#ensureEngine();
  const modelPath=await this.#ensureModel();
  const port=await this.#startServer(executable,modelPath,this.#paths().key,key,profile);
  await this.#writeState({port,engineVersion:LOCAL_AI_ENGINE.version,modelRevision:LOCAL_AI_MODEL.revision,modelPath,executable});
  await this.#writeOpenCodeConfig(port);
  this.#ready={port,key,configPath:this.#configPath};
  this.#emit({phase:'ready',supported:true,running:true,installed:true,percent:100,port,endpoint:'http://127.0.0.1:'+port+'/v1',model:LOCAL_AI_MODEL.name,message:'IA local pronta. O modelo ficará ocioso e liberará memória após 5 minutos sem uso.'});
  return {...this.#lastStatus};
 }
 async status(){
  const profile=selectLocalAIProfile(this.#hardware);
  if(!profile.supported)return {phase:'unsupported',supported:false,running:false,installed:false,message:profile.reason};
  if(this.#lastStatus&&['checking','downloading-engine','extracting-engine','downloading-model','starting'].includes(this.#lastStatus.phase))return {...this.#lastStatus};
  const paths=this.#paths(),key=await this.#readKey(),state=await this.#readState();
  const executable=await findFile(paths.engineDir,'llama-server.exe');
  const modelInstalled=await exists(paths.model);
  const port=key?await this.#findExistingServer(key):null;
  if(port){
   await this.#writeOpenCodeConfig(port);
   this.#ready={port,key,configPath:this.#configPath};
  }
  const installed=!!executable&&modelInstalled;
  return {
   phase:port?'ready':installed?'installed':'not-installed',
   supported:true,installed,running:!!port,engineInstalled:!!executable,modelInstalled,
   port:port||null,endpoint:port?'http://127.0.0.1:'+port+'/v1':null,
   model:LOCAL_AI_MODEL.name,modelSizeLabel:'1,19 GB',
   threads:profile.threads,context:profile.context,
   message:port?'IA local conectada e disponível.':installed?'Motor e modelo instalados; inicie para carregar a IA.':'Pronta para instalação automática. O primeiro download usa cerca de 1,22 GB.'
  };
 }
 async openCodeEnvironment(){
  const status=await this.status();
  if(!status.running)return null;
  const key=await this.#readKey();
  if(!key)return null;
  return {configPath:this.#configPath,apiKey:key};
 }
}
