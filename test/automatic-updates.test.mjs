import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectProductRelease} from '../src/distribution.mjs';
import {downloadVerifiedRelease} from '../src/update-security.mjs';
import {shouldAutoUpdateInstalledProduct} from '../src/product-auto-update.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function example(version,preview,prefix='LexisPredict',bytes=Buffer.alloc(1_000_000,77)){
 const tag=(preview?'preview-v':'v')+version;
 const name=prefix+'-Setup-'+version+'-x64.exe';
 const url='https://github.com/W1CAPITAL/Central-de-Apps/releases/download/'+tag+'/'+name;
 return {tag_name:tag,prerelease:preview,draft:false,assets:[{name,size:bytes.length,
  digest:'sha256:'+sha(bytes),browser_download_url:url}]};
}

test('catálogo manual encontra a preview mais nova do GitHub com hash',()=>{
 const releases=[example('0.1.290',false),example('0.1.329',true)];
 const selected=selectProductRelease(releases,'lexispredict',{allowPreview:true});
 assert.equal(selected.version,'0.1.329');
 assert.equal(selected.preview,true);
 assert.equal(selected.sha256,sha(Buffer.alloc(1_000_000,77)));
});

test('download automático de preview verificada não exige certificado mas continua rejeitando corrupção',async()=>{
 const bytes=Buffer.alloc(1_000_000,77);
 const release=example('0.1.329',true);
 const asset=selectProductRelease([release],'lexispredict',{allowPreview:true});
 const folder=mkdtempSync(join(tmpdir(),'w1-auto-preview-'));
 const fetchImpl=async url=>{
  assert.equal(url,asset.url);
  const response=new Response(bytes);
  Object.defineProperty(response,'url',{value:url});
  return response;
 };
 try{
  const file=await downloadVerifiedRelease({asset,folder,fetchImpl,signatureScript:'not-required-for-preview'});
  assert.match(file,/LexisPredict-Setup-0\.1\.329/);
  const corrupted=example('0.1.329',true,'LexisPredict',Buffer.alloc(1_000_000,78));
  const other=selectProductRelease([corrupted],'lexispredict',{allowPreview:true});
  await assert.rejects(()=>downloadVerifiedRelease({asset:other,folder,fetchImpl,signatureScript:'not-required-for-preview'}),/SHA-256|hash/i);
 }finally{rmSync(folder,{recursive:true,force:true})}
});

test('atualiza apenas apps já instalados, em versão mais velha, com atualizações ligadas e app fechado',()=>{
 const base={enabled:true,installed:true,installedVersion:'0.1.290',candidateVersion:'0.1.329',running:false};
 assert.equal(shouldAutoUpdateInstalledProduct(base),true);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,enabled:false}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,installed:false}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,running:true}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,installedVersion:'0.1.329'}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,installedVersion:'0.1.330'}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,installedVersion:null}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,preview:true}),false);
 assert.equal(shouldAutoUpdateInstalledProduct({...base,candidateVersion:'fake'}),false);
});
