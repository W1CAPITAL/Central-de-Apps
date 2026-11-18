import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {productSpec} from '../src/distribution.mjs';

const [id,target='nsis']=process.argv.slice(2);
const spec=productSpec(id);
if(!['lexispredict','predictbot'].includes(id)||!['dir','nsis'].includes(target))throw Error('Produto ou alvo não permitido.');
const root=resolve(import.meta.dirname,'..');
const descriptor=join(root,'src','product-build.json');
const original=readFileSync(descriptor);
const temporary=mkdtempSync(join(tmpdir(),'w1-product-config-'));
const config=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).build;
config.appId=spec.appId;config.productName=spec.name;
config.directories={output:join(root,'dist','products',id)};
config.win={...config.win,artifactName:spec.prefix+'-Setup-${version}-${arch}.exe'};
config.extraResources=id==='predictbot'?[]:[{from:'products',to:'products',filter:[id+'/**/*',
 '!**/.env','!**/.env.*','!**/*service-role*','!**/private-key*','!**/*.pem']}];
const path=join(temporary,'product.json');
writeFileSync(path,JSON.stringify(config));
try{
 writeFileSync(descriptor,JSON.stringify({id}));
 const builder=join(root,'node_modules','electron-builder','out','cli','cli.js');
 const result=spawnSync(process.execPath,[builder,'--config',path,'--win',target,'--x64','--publish','never'],{cwd:root,stdio:'inherit',shell:false});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Empacotamento '+id+' falhou: '+result.status);
}finally{
 writeFileSync(descriptor,original);
 rmSync(temporary,{recursive:true,force:true});
}
