import {cpSync,existsSync,mkdirSync,readFileSync,realpathSync,rmSync,readdirSync} from 'node:fs';
import {resolve,join,dirname,relative} from 'node:path';
import {createRequire} from 'node:module';
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
function materializeNextDependencies(sourceModules,targetModules){
 const nextSource=realpathSync(join(sourceModules,'next'));
 const manifest=JSON.parse(readFileSync(join(nextSource,'package.json'),'utf8'));
 const requireNext=createRequire(join(nextSource,'package.json'));
 for(const dependency of Object.keys(manifest.dependencies??{})){
  const rootTarget=join(targetModules,dependency);
  const nestedTarget=join(targetModules,'next','node_modules',dependency);
  // Standalone traces are also emitted as ordinary npm layouts on Windows.
  // Resolve from Next itself: a dependency can live in next/node_modules or
  // be hoisted higher than the directory containing the real Next package.
  let source;
  try{source=dirname(requireNext.resolve(dependency+'/package.json'))}
  catch{
   if(existsSync(join(rootTarget,'package.json')))source=rootTarget;
   else throw Error('Dependência Next ausente do standalone: '+dependency);
  }
  if(!existsSync(rootTarget))
   cpSync(source,rootTarget,{recursive:true,dereference:true,filter:path=>!privateFile(path)});
  if(!existsSync(nestedTarget))
   cpSync(rootTarget,nestedTarget,{recursive:true,dereference:true,filter:path=>!privateFile(path)});
 }
}
export function stageNext(sourcePath,id,{productsRoot=resolve(import.meta.dirname,'..','products')}={}){
 resolveApp(id);
 const root=resolve(sourcePath);
 const output=join(root,'.next','standalone');
 const entry=existsSync(output)?findEntrypoint(output):null;
 if(!entry)throw Error('Não há Next standalone para '+id+'; execute o build local antes.');
 const base=dirname(entry);
 const target=resolve(productsRoot,id);
 rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
 // pnpm's standalone output can contain symlinks into its virtual store.
 // Electron-builder may omit those links from extraResources on Windows.
 // Materialize actual files before packaging, not a pointer to the build workspace.
 cpSync(base,target,{recursive:true,dereference:true,filter:path=>!privateFile(path)});
 // Next may hoist its traced node_modules above a nested server.js.
 if(base!==output&&existsSync(join(output,'node_modules'))){
  cpSync(join(output,'node_modules'),join(target,'node_modules'),{
   recursive:true,dereference:true,filter:path=>!privateFile(path)
  });
 }
 // Validate the portable destination, not one assumed source layout. Next
 // can put node_modules beside a nested server.js instead of standalone/.
 if(existsSync(join(target,'node_modules','next')))
  materializeNextDependencies(join(target,'node_modules'),join(target,'node_modules'));
 for(const [from,to] of [[join(root,'public'),join(target,'public')],[join(root,'.next','static'),join(target,'.next','static')]]){
  if(existsSync(from))cpSync(from,to,{recursive:true,dereference:true});
 }
 for(const required of [
  join(target,'server.js'),join(target,'.next','BUILD_ID'),
  join(target,'node_modules','next','package.json'),
  join(target,'node_modules','next','node_modules','styled-jsx','package.json'),
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
