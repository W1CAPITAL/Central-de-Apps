import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {productSpec} from './distribution.mjs';
const VERSION=/^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const PRODUCT_NAMES=Object.freeze({lexispredict:'LexisPredict',infinitum:'INFINITUM',predictbot:'PredictBot'});
function nameFor(id){
 productSpec(id);
 if(!Object.hasOwn(PRODUCT_NAMES,id))throw Error('Produto independente não permitido.');
 return PRODUCT_NAMES[id];
}
export function productInstallation(id,{localAppData=process.env.LOCALAPPDATA,exists=existsSync}={}){
 const name=nameFor(id);
 if(typeof localAppData!=='string'||!localAppData.trim())throw Error('Pasta local do Windows indisponível.');
 const directory=join(resolve(localAppData),'Programs',name),exe=join(directory,name+'.exe');
 return Object.freeze({id,directory,exe,installed:exists(exe)});
}
export function planProductInstall(id,{localAppData=process.env.LOCALAPPDATA,installerPath}={}){
 const target=productInstallation(id,{localAppData});
 if(typeof installerPath!=='string'||!installerPath.toLowerCase().endsWith('.exe'))
  throw Error('Instalador do produto inválido.');
 return Object.freeze({...target,executablePath:target.exe,installerPath,args:Object.freeze(['/S','/D='+target.directory])});
}
export function readProductRecord(file,id){
 nameFor(id);
 try{
  const records=JSON.parse(readFileSync(file,'utf8'));
  const entry=records?.[id];
  if(entry&&VERSION.test(String(entry.version||'')))return {version:entry.version};
 }catch{}
 return null;
}
export function writeProductRecord(file,id,version){
 nameFor(id);
 if(!VERSION.test(String(version||'')))throw Error('Versão instalada inválida.');
 let entries={};
 try{
  const current=JSON.parse(readFileSync(file,'utf8'));
  if(current&&typeof current==='object'&&!Array.isArray(current))entries=current;
 }catch{}
 entries[id]={version,updatedAt:new Date().toISOString()};
 mkdirSync(dirname(file),{recursive:true});
 writeFileSync(file,JSON.stringify(entries),'utf8');
}
