import {randomBytes,createHash} from 'node:crypto';
import {createReadStream,createWriteStream,existsSync,mkdirSync,rmSync,renameSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export const OPENCODE_RELEASES_API='https://api.github.com/repos/anomalyco/opencode/releases?per_page=20';
const REPO='anomalyco/opencode',INSTALLER='opencode-desktop-win-x64.exe';
const VERSION=/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,4})$/;
const HTTPS_HOSTS=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);
const MIN_SIZE=20_000_000,MAX_SIZE=600_000_000;

function newer(a,b){
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];
 return 0;
}
/** Do not use /releases/latest: that endpoint can lag behind stable 2.x releases. */
export function chooseOpenCodeDesktopRelease(releases){
 if(!Array.isArray(releases)||releases.length>25)throw Error('Catálogo OpenCode inválido.');
 let best=null;
 for(const release of releases){
  if(release?.draft===true||release?.prerelease===true)continue;
  const tag=String(release?.tag_name||''),version=tag.startsWith('v')?tag.slice(1):'';
  if(!VERSION.test(version))continue;
  const url='https://github.com/'+REPO+'/releases/download/'+tag+'/'+INSTALLER;
  const asset=release?.assets?.find(x=>x?.name===INSTALLER&&x?.browser_download_url===url);
  if(!asset||!Number.isSafeInteger(asset.size)||asset.size<MIN_SIZE||asset.size>MAX_SIZE||
   !/^sha256:[a-f0-9]{64}$/i.test(String(asset.digest||'')))continue;
  if(!best||newer(version,best.version)>0)best=Object.freeze({
   version,name:INSTALLER,url,size:asset.size,sha256:asset.digest.slice(7).toLowerCase(),
   releaseUrl:'https://github.com/'+REPO+'/releases/tag/'+tag
  });
 }
 return best;
}

async function verifyCached(file,asset){
 if(!existsSync(file)||statSync(file).size!==asset.size)return false;
 const sha=createHash('sha256');
 for await(const chunk of createReadStream(file))sha.update(chunk);
 return sha.digest('hex')===asset.sha256;
}
function trustedHost(raw){
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&!url.username&&!url.password&&
   (url.port===''||url.port==='443')&&HTTPS_HOSTS.has(url.hostname.toLowerCase());
 }catch{return false}
}

/**
 * Only downloads the exact official OpenCode Windows x64 installer. Does not
 * execute it: the user must explicitly authorize the repair/update action.
 */
export async function downloadVerifiedOpenCodeDesktop({asset,folder,fetchImpl=fetch,onProgress=()=>{}}={}){
 if(!asset||!VERSION.test(asset.version)||asset.name!==INSTALLER||
  asset.url!=='https://github.com/'+REPO+'/releases/download/v'+asset.version+'/'+INSTALLER||
  !Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>MAX_SIZE||
  !/^[a-f0-9]{64}$/i.test(String(asset.sha256||'')))throw Error('Instalador OpenCode não autorizado.');
 if(typeof folder!=='string'||!folder.trim())throw Error('Pasta do instalador ausente.');
 mkdirSync(folder,{recursive:true});
 const file=join(folder,'opencode-desktop-win-x64-'+asset.version+'.exe');
 if(await verifyCached(file,asset)){onProgress(100);return file}
 const temporary=file+'.'+process.pid+'.'+randomBytes(6).toString('hex')+'.part';
 let length=0;
 try{
  const response=await fetchImpl(asset.url,{redirect:'follow',cache:'no-store',
   headers:{'User-Agent':'W1-Central-OpenCode-Updater','Accept':'application/octet-stream'},
   signal:AbortSignal.timeout(30*60*1000)});
  if(!response?.ok||!response.body||!trustedHost(response.url||asset.url))
   throw Error('Download HTTPS oficial do OpenCode indisponível.');
  const declared=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>0&&declared!==asset.size)
   throw Error('Tamanho informado não corresponde à release OpenCode.');
  const sha=createHash('sha256');
  const meter=new Transform({transform(chunk,encoding,callback){
   length+=chunk.length;
   if(length>asset.size){callback(Error('Download excedeu o tamanho permitido.'));return}
   sha.update(chunk);
   try{onProgress(Math.min(99,Math.floor(length/asset.size*100)))}catch{}
   callback(null,chunk);
  }});
  await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(temporary,{flags:'wx',mode:0o600}));
  if(length!==asset.size||sha.digest('hex')!==asset.sha256)
   throw Error('SHA-256 do OpenCode não corresponde à release oficial.');
  rmSync(file,{force:true});
  renameSync(temporary,file);
  onProgress(100);
  return file;
 }catch(error){rmSync(temporary,{force:true});throw error;}
}
