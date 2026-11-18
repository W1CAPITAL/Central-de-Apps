import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchReleaseCatalog, RELEASE_CATALOG_FALLBACK_URL} from '../src/distribution.mjs';

const version='0.1.88';
const tag='v'+version;
const digest='sha256:'+'c'.repeat(64);
const spec=[
 ['W1-Central-de-Apps',180_000_000],
 ['LexisPredict',180_000_000],
 ['INFINITUM',120_000_000],
 ['PredictBot',100_000_000]
];
const release={
 tag_name:tag,prerelease:false,draft:false,
 assets:spec.map(([prefix,size])=>({
  name:prefix+'-Setup-'+version+'-x64.exe',size,digest,
  browser_download_url:'https://github.com/W1CAPITAL/Central-de-Apps/releases/download/'+tag+'/'+prefix+'-Setup-'+version+'-x64.exe'
 }))
};
const response=(body,status=200,url='https://api.github.com/repos/W1CAPITAL/Central-de-Apps/releases?per_page=12')=>
 new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('busca catalogo no endpoint oficial quando disponivel sem requisicoes extras',async()=>{
 const calls=[];
 const result=await fetchReleaseCatalog(async url=>{
  calls.push(url);return response([release]);
 });
 assert.equal(result[0].tag_name,tag);
 assert.equal(calls.length,1);
});

test('se a API GitHub estiver temporariamente limitada usa manifesto estavel oficial',async()=>{
 const calls=[];
 const result=await fetchReleaseCatalog(async url=>{
  calls.push(url);
  if(calls.length===1)return response({message:'rate limit'},403);
  assert.equal(url,RELEASE_CATALOG_FALLBACK_URL);
  const reply=response(release,200);
  Object.defineProperty(reply,'url',{value:RELEASE_CATALOG_FALLBACK_URL});
  return reply;
 });
 assert.equal(result.length,1);
 assert.equal(result[0].assets.length,4);
 assert.equal(calls.length,2);
});

test('falha fechada se fallback vier de host diferente ou manipulada',async()=>{
 const source=async url=>{
  if(String(url).includes('api.github.com'))throw Error('rede');
  const reply=response({...release,assets:[]});
  Object.defineProperty(reply,'url',{value:'https://example.evil/release-catalog.json'});
  return reply;
 };
 await assert.rejects(()=>fetchReleaseCatalog(source),/GitHub|origem|indispon/i);
});

test('manifests sem hash ou com versao preview nao habilitam instalacao',async()=>{
 for(const payload of [{...release,assets:release.assets.map((x,i)=>i?x:{...x,digest:''})},
  {...release,tag_name:'preview-v'+version,prerelease:true}]){
  await assert.rejects(()=>fetchReleaseCatalog(async url=>{
   if(String(url).includes('api.github.com'))return response({message:'rate'},403);
   const reply=response(payload);
   Object.defineProperty(reply,'url',{value:RELEASE_CATALOG_FALLBACK_URL});
   return reply;
  }),/GitHub|catalogo|indispon/i);
 }
});
