import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,resolve,isAbsolute,win32} from 'node:path';
import {productSpec} from './distribution.mjs';

const VERSION=/^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const PRODUCT_NAMES=Object.freeze({lexispredict:'LexisPredict',infinitum:'INFINITUM',predictbot:'PredictBot'});
function nameFor(id){
 productSpec(id);
 if(!Object.hasOwn(PRODUCT_NAMES,id))throw Error('Produto independente não permitido.');
 return PRODUCT_NAMES[id];
}
function safeDirectory(folder){
 return typeof folder==='string'&&folder.length>3&&!folder.includes('\0')&&
   (isAbsolute(folder)||win32.isAbsolute(folder));
}
/** Detecta instalações padrão, variantes do NSIS e destinos salvos de atualização. */
export function productInstallation(id,{
 localAppData=process.env.LOCALAPPDATA,exists=existsSync,storedDirectory=null,
 programFiles=process.env.ProgramFiles,programFilesX86=process.env['ProgramFiles(x86)']
}={}){
 const name=nameFor(id);
 if(typeof localAppData!=='string'||!localAppData.trim())throw Error('Pasta local do Windows indisponível.');
 const root=resolve(localAppData),base=join(root,'Programs');
 const defaultDir=join(base,name);
 const variants=[name,name.toLowerCase(),id];
 const roots=[base,root,...[programFiles,programFilesX86].filter(safeDirectory)];
 const directories=[...(safeDirectory(storedDirectory)?[storedDirectory]:[]),
  ...roots.flatMap(dir=>variants.map(variant=>join(dir,variant)))];
 const visited=new Set();
 for(const directory of directories){
  const key=directory.toLowerCase();
  if(visited.has(key))continue;
  visited.add(key);
  const exe=join(directory,name+'.exe');
  if(exists(exe))return Object.freeze({id,directory,exe,installed:true});
 }
 const exe=join(defaultDir,name+'.exe');
 return Object.freeze({id,directory:defaultDir,exe,installed:false});
}
export function planProductInstall(id,{localAppData=process.env.LOCALAPPDATA,storedDirectory,installerPath}={}){
 const target=productInstallation(id,{localAppData,storedDirectory});
 if(typeof installerPath!=='string'||!installerPath.toLowerCase().endsWith('.exe'))
  throw Error('Instalador do produto inválido.');
 return Object.freeze({...target,executablePath:target.exe,installerPath,args:Object.freeze(['/S','/D='+target.directory])});
}
export function readProductRecord(file,id){
 nameFor(id);
 try{
  const records=JSON.parse(readFileSync(file,'utf8'));
  const entry=records?.[id];
  if(entry&&VERSION.test(String(entry.version||''))){
   return {version:entry.version,...(safeDirectory(entry.directory)?{directory:entry.directory}:{})};
  }
 }catch{}
 return null;
}
export function writeProductRecord(file,id,version,directory){
 nameFor(id);
 if(!VERSION.test(String(version||'')))throw Error('Versão instalada inválida.');
 if(directory!==undefined&&!safeDirectory(directory))throw Error('Pasta instalada inválida.');
 let entries={};
 try{
  const current=JSON.parse(readFileSync(file,'utf8'));
  if(current&&typeof current==='object'&&!Array.isArray(current))entries=current;
 }catch{}
 entries[id]={version,updatedAt:new Date().toISOString(),...(directory?{directory}:{})};
 mkdirSync(dirname(file),{recursive:true});
 writeFileSync(file,JSON.stringify(entries),'utf8');
}
