import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream,statSync,mkdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {validateProductRelease} from './distribution.mjs';
import {pruneUpdateCache} from './update-install.mjs';

const APP_REPO='W1CAPITAL/Central-de-Apps';
const MAX_BYTES=2_000_000_000;
const MIN_BYTES=10_000_000;
const VERSION=/^(0|[1-9][0-9]{0,3})[.](0|[1-9][0-9]{0,3})[.](0|[1-9][0-9]{0,3})$/;
const HOSTS=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);

export function validateReleaseAsset(release,product='central'){
 if(product!=='central')return validateProductRelease(release,product);
 if(release?.prerelease===true||release?.draft===true)throw Error('Versão de teste fora do canal oficial.');
 const tag=String(release?.tag_name||'');
 const version=tag.startsWith('v')?tag.slice(1):'';
 if(!VERSION.test(version))throw Error('Versão oficial inválida.');
 const name='W1-Central-de-Apps-Setup-'+version+'-x64.exe';
 const asset=release?.assets?.find(item=>item?.name===name);
 if(!asset)throw Error('Release sem instalador Windows x64 oficial.');
 if(!Number.isInteger(asset.size)||asset.size<MIN_BYTES||asset.size>MAX_BYTES)
  throw Error('Tamanho do instalador inválido.');
 const url='https://github.com/'+APP_REPO+'/releases/download/v'+version+'/'+name;
 if(asset.browser_download_url!==url)throw Error('URL do instalador não autorizada.');
 const digest=String(asset.digest||'');
 if(!/^sha256:[a-f0-9]{64}$/i.test(digest))
  throw Error('Release não possui hash SHA-256 válido.');
 return Object.freeze({product:'central',version,name,url,size:asset.size,sha256:digest.slice(7).toLowerCase()});
}
function trustedDownloadResponse(value){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&HOSTS.has(u.hostname.toLowerCase());
 }catch{return false}
}
export async function verifyFileDigest(file,asset){
 if(statSync(file).size!==asset.size)throw Error('Instalador local mudou de tamanho.');
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 if(hash.digest('hex')!==asset.sha256)throw Error('O instalador local não corresponde ao SHA-256 oficial.');
 return true;
}

// Automatic updates rely on the GitHub release SHA-256 and HTTPS origin.
// Authenticode remains optional; it is not a prerequisite for replacing an installed build.
export async function downloadVerifiedRelease(options){
 return downloadRelease({...options,markOfWeb:false});
}
// Manual installers retain Windows' Internet-zone marking.
export async function downloadProductCopy(options){
 return downloadRelease({...options,markOfWeb:true});
}
async function downloadRelease({asset,folder,onProgress=()=>{},fetchImpl=fetch,markOfWeb}){
 if(asset?.product){
  const tag=(asset.preview?'preview-v':'v')+asset.version;
  validateProductRelease({tag_name:tag,prerelease:asset.preview,assets:[{
   name:asset.name,browser_download_url:asset.url,size:asset.size,digest:'sha256:'+asset.sha256
  }]},asset.product,{manual:markOfWeb});
 }else{
  if(!asset||!VERSION.test(asset.version)||asset.name!=='W1-Central-de-Apps-Setup-'+asset.version+'-x64.exe')
   throw Error('Instalador não passou pela validação do catálogo.');
  validateReleaseAsset({tag_name:'v'+asset.version,assets:[{
   name:asset.name,browser_download_url:asset.url,size:asset.size,digest:'sha256:'+asset.sha256
  }]});
 }
 mkdirSync(folder,{recursive:true});
 const file=join(folder,asset.name);
 if(!markOfWeb){
  try{
   await verifyFileDigest(file,asset);
   onProgress(100);
   return file;
  }catch{ /* No complete, matching cached installer. Fetch a verified copy. */ }
 }
 const tmp=file+'.partial.exe';
 rmSync(tmp,{force:true});
 let total=0;
 const hash=createHash('sha256');
 try{
  const response=await fetchImpl(asset.url,{redirect:'follow',cache:'no-store',
   signal:AbortSignal.timeout(20*60*1000)});
  if(!response.ok||!response.body||!trustedDownloadResponse(response.url||asset.url))
   throw Error('Falha no download HTTPS oficial.');
  const rawLength=Number(response.headers.get('content-length'));
  if(Number.isFinite(rawLength)&&rawLength>asset.size)
   throw Error('Tamanho de download maior que a release publicada.');
  const counter=new Transform({
   transform(chunk,enc,callback){
    total+=chunk.length;
    if(total>asset.size||total>MAX_BYTES){callback(Error('Download excedeu o limite de bytes.'));return}
    hash.update(chunk);
    onProgress(Math.floor(total/asset.size*100));
    callback(null,chunk);
   }
  });
  await pipeline(Readable.fromWeb(response.body),counter,createWriteStream(tmp,{flags:'wx',mode:0o600}));
  if(total!==asset.size||hash.digest('hex')!==asset.sha256)
   throw Error('Hash SHA-256 do instalador não corresponde à release oficial.');
  if(markOfWeb&&process.platform==='win32')
   writeFileSync(tmp+':Zone.Identifier','[ZoneTransfer]\\r\\nZoneId=3\\r\\nHostUrl='+asset.url+'\\r\\n');
  // Replace an older copy of this exact installer only after the new bytes pass verification.
  rmSync(file,{force:true});
  renameSync(tmp,file);
  try{pruneUpdateCache(folder,asset.name)}catch{}
  return file;
 }catch(error){
  rmSync(tmp,{force:true});
  throw error;
 }
}
