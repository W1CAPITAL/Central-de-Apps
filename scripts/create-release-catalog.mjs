import {existsSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const PREFIXES=['W1-Central-de-Apps','LexisPredict','INFINITUM','PredictBot'];
const VERSION=/^\d+\.\d+\.\d+$/;
const SHA=/^[a-f0-9]{64}$/i;

export function generateReleaseCatalog(version,files){
 if(!VERSION.test(version))throw Error('Versão estável inválida.');
 if(!files||typeof files!=='object')throw Error('Manifesto incompleto.');
 const tag='v'+version;
 const assets=PREFIXES.map(prefix=>{
  const file=files[prefix];
  if(!file||!Number.isSafeInteger(file.size)||file.size<10_000_000)
   throw Error('Instalador ausente ou incompleto: '+prefix);
  if(typeof file.sha256!=='string'||!SHA.test(file.sha256))
   throw Error('SHA-256 inválido para '+prefix);
  const name=prefix+'-Setup-'+version+'-x64.exe';
  return {
   name,size:file.size,digest:'sha256:'+file.sha256.toLowerCase(),
   browser_download_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/'+tag+'/'+name
  };
 });
 return {tag_name:tag,prerelease:false,draft:false,assets};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const version=process.argv[2],root=process.cwd();
 if(!VERSION.test(version||''))throw Error('Informe a versão estável de publicação.');
 const sumFile=join(root,'SHA256SUMS.txt');
 if(!existsSync(sumFile))throw Error('SHA256SUMS.txt ausente.');
 const entries=new Map();
 for(const line of readFileSync(sumFile,'utf8').split(/\r?\n/)){
  const match=line.trim().match(/^([a-f0-9]{64})\s+(.+)$/i);
  if(match)entries.set(match[2].trim(),match[1].toLowerCase());
 }
 const files={};
 for(const prefix of PREFIXES){
  const name=prefix+'-Setup-'+version+'-x64.exe';
  const folder=prefix==='W1-Central-de-Apps'?join(root,'dist'):
   join(root,'dist','products',prefix==='LexisPredict'?'lexispredict':prefix==='INFINITUM'?'infinitum':'predictbot');
  const path=join(folder,name),sha256=entries.get(name);
  if(!existsSync(path)||!sha256)throw Error('Instalador ou digest ausente: '+name);
  files[prefix]={size:statSync(path).size,sha256};
 }
 const catalog=generateReleaseCatalog(version,files);
 writeFileSync(join(root,'release-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 console.log('Manifesto alternativo GitHub preparado para '+catalog.tag_name);
}
