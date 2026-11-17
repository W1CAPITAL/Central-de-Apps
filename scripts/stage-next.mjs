import {cpSync,existsSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import {resolve,join,dirname,relative} from 'node:path';
import {resolveApp} from '../src/catalog.mjs';

function findEntrypoint(base,depth=0){
 if(depth>5)return null;
 if(existsSync(join(base,'server.js')))return join(base,'server.js');
 for(const e of readdirSync(base,{withFileTypes:true})){
  if(!e.isDirectory()||e.name==='node_modules'||e.name.startsWith('.'))continue;
  const item=findEntrypoint(join(base,e.name),depth+1);
  if(item)return item;
 }
 return null;
}
function privateFile(path){
 return /(^|[/\\])\.env(?:\.|$)|service[_-]?role|private[_-]?key|\.pem$|\.p12$|\.pfx$/i.test(path);
}
export function stageNext(sourcePath,id){
 resolveApp(id);
 const root=resolve(sourcePath);
 const output=join(root,'.next','standalone');
 const entry=existsSync(output)?findEntrypoint(output):null;
 if(!entry)throw Error('Não há Next standalone para '+id+'; execute o build local antes.');
 const base=dirname(entry);
 const target=resolve(import.meta.dirname,'..','products',id);
 rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
 cpSync(base,target,{recursive:true,filter:path=>!privateFile(path)});
 // Next may hoist its traced node_modules above a nested server.js.
 if(base!==output&&existsSync(join(output,'node_modules'))){
  cpSync(join(output,'node_modules'),join(target,'node_modules'),{
   recursive:true,filter:path=>!privateFile(path)
  });
 }
 for(const [from,to] of [[join(root,'public'),join(target,'public')],[join(root,'.next','static'),join(target,'.next','static')]]){
  if(existsSync(from))cpSync(from,to,{recursive:true});
 }
 for(const required of [
  join(target,'server.js'),join(target,'.next','BUILD_ID'),
  join(target,'node_modules','next','package.json'),
  join(target,'node_modules','next','dist','server','lib','start-server.js')
 ]){
  if(!existsSync(required))throw Error('Standalone '+id+' incompleto: '+relative(target,required));
 }
 for(const file of readdirSync(target))if(privateFile(file))throw Error('Arquivo privado encontrado no pacote: '+file);
 return {id,target};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const [source,id]=process.argv.slice(2);
 if(!source||!id)throw Error('Uso: node scripts/stage-next.mjs <fonte> <lexispredict|infinitum>');
 console.log(stageNext(source,id));
}
