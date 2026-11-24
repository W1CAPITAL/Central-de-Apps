import {join} from 'node:path';
import {productSpec,selectProductRelease} from './distribution.mjs';
import {downloadProductCopy,verifyFileDigest} from './update-security.mjs';

export class ProductDownloads {
 #folder;#notify;#fetch;#items=new Map();#busy=new Map();
 constructor({folder,onState=()=>{},fetchImpl=fetch}){this.#folder=folder;this.#notify=onState;this.#fetch=fetchImpl;}
 snapshot(id){
  productSpec(id);const item=this.#items.get(id);
  return item?{version:item.asset.version,preview:item.asset.preview,sha256:item.asset.sha256,phase:item.phase,percent:item.percent,error:item.error||null}:
   {version:null,phase:'unavailable',percent:0,error:null};
 }
 update(releases){
  for(const id of ['lexispredict','infinitum','predictbot']){
   if(this.#busy.has(id))continue;
   const asset=selectProductRelease(releases,id,{manual:true});
   const previous=this.#items.get(id);
   if(asset&&(previous?.asset.url!==asset.url||previous?.asset.sha256!==asset.sha256))this.#items.set(id,{asset,phase:'available',percent:0,path:null});
   else if(!asset)this.#items.delete(id);
  }
  this.#notify();
 }
 async download(id){
  productSpec(id);
  if(this.#busy.has(id))return this.#busy.get(id);
  const item=this.#items.get(id);
  if(!item)throw Error('Nenhum instalador publicado para este aplicativo.');
  item.phase='downloading';item.error=null;this.#notify();
  const task=downloadProductCopy({asset:item.asset,folder:join(this.#folder,id),fetchImpl:this.#fetch,
   onProgress:percent=>{item.percent=percent;this.#notify();}})
   .then(path=>{item.path=path;item.phase='downloaded';item.percent=100;return this.snapshot(id);})
   .catch(error=>{item.path=null;item.phase='error';item.error=String(error.message||'Download falhou.').slice(0,180);throw error;})
   .finally(()=>{this.#busy.delete(id);this.#notify();});
  this.#busy.set(id,task);return task;
 }
 async verifiedPackage(id){
  productSpec(id);const item=this.#items.get(id);
  if(!item?.path||item.phase!=='downloaded')throw Error('Baixe o aplicativo primeiro.');
  await verifyFileDigest(item.path,item.asset);
  if(this.#items.get(id)!==item)throw Error('A release mudou durante a verificação.');
  return {path:item.path,asset:item.asset};
 }
 async verifiedPath(id){return (await this.verifiedPackage(id)).path}
}
