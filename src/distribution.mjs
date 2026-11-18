export const RELEASES_API='https://api.github.com/repos/W1CAPITAL/Central-de-Apps/releases?per_page=12';
const REPO='W1CAPITAL/Central-de-Apps';
const VERSION=/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
export const PRODUCTS=Object.freeze({
 central:Object.freeze({id:'central',name:'W1 Central de Apps',prefix:'W1-Central-de-Apps',appId:'br.com.w1capital.centraldeapps'}),
 lexispredict:Object.freeze({id:'lexispredict',name:'LexisPredict',prefix:'LexisPredict',appId:'br.com.w1capital.lexispredict'}),
 predictbot:Object.freeze({id:'predictbot',name:'PredictBot',prefix:'PredictBot',appId:'br.com.w1capital.predictbot'})
});
export function productSpec(id){
 if(typeof id!=='string'||!Object.hasOwn(PRODUCTS,id))throw Error('Produto não autorizado.');
 return PRODUCTS[id];
}
export function compareVersions(a,b){
 if(!VERSION.test(a)||!VERSION.test(b))return 0;
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];
 return 0;
}
export function validateProductRelease(release,id,{manual=false}={}){
 const spec=productSpec(id);
 if(release?.draft===true)throw Error('Rascunho fora do canal oficial.');
 const preview=release?.prerelease===true;
 if(preview&&!manual)throw Error('Versão de teste fora do canal oficial.');
 const tag=String(release?.tag_name||'');
 const prefix=preview?'preview-v':'v';
 const version=tag.startsWith(prefix)?tag.slice(prefix.length):'';
 if(!VERSION.test(version))throw Error('Versão oficial inválida.');
 const name=spec.prefix+'-Setup-'+version+'-x64.exe';
 const asset=release?.assets?.find(a=>a?.name===name);
 const url='https://github.com/'+REPO+'/releases/download/'+tag+'/'+name;
 if(!asset||asset.browser_download_url!==url)throw Error('Instalador do produto ausente ou origem não autorizada.');
 if(!Number.isSafeInteger(asset.size)||asset.size<(id==='central'?10_000_000:1_000_000)||asset.size>2_000_000_000)throw Error('Tamanho de instalador inválido.');
 if(!/^sha256:[a-f0-9]{64}$/i.test(asset.digest||''))throw Error('Hash SHA-256 inválido.');
 return Object.freeze({product:id,version,name,url,size:asset.size,sha256:asset.digest.slice(7).toLowerCase(),preview,
  releaseUrl:'https://github.com/'+REPO+'/releases/tag/'+tag});
}
export function selectProductRelease(releases,id,options){
 if(!Array.isArray(releases)||releases.length>12)throw Error('Catálogo de versões inválido.');
 const assets=[];
 for(const release of releases){try{assets.push(validateProductRelease(release,id,options))}catch{}}
 return assets.sort((a,b)=>compareVersions(b.version,a.version))[0]||null;
}
export async function fetchReleaseCatalog(fetchImpl=fetch){
 const response=await fetchImpl(RELEASES_API,{headers:{Accept:'application/vnd.github+json','User-Agent':'W1-Central-de-Apps'},
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok||!response.body)throw Error('Não foi possível consultar as versões ('+response.status+').');
 let bytes=0;const chunks=[];
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>256000)throw Error('Catálogo excedeu o tamanho permitido.');chunks.push(Buffer.from(chunk));}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!Array.isArray(data)||data.length>12)throw Error('Catálogo inválido.');
 return data;
}
