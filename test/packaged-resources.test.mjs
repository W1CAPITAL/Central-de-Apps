import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {getFileMatchers,copyFiles} from 'app-builder-lib/out/fileMatcher.js';

test('electron-builder preserva node_modules de ambos os produtos e exclui segredos',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'w1-package-'));
 try{
  const config=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).build;
  for(const id of ['lexispredict','infinitum','unapproved']){
   const root=join(folder,'products',id);
   mkdirSync(join(root,'node_modules','next','dist','server','lib'),{recursive:true});
   mkdirSync(join(root,'.next'),{recursive:true});
   writeFileSync(join(root,'server.js'),'// synthetic server');
   writeFileSync(join(root,'.next','BUILD_ID'),'synthetic-build');
   writeFileSync(join(root,'node_modules','next','package.json'),'{"name":"next"}');
   mkdirSync(join(root,'node_modules','next','node_modules','styled-jsx'),{recursive:true});
   writeFileSync(join(root,'node_modules','next','node_modules','styled-jsx','package.json'),'{"name":"styled-jsx"}');
   writeFileSync(join(root,'node_modules','next','dist','server','lib','start-server.js'),'// synthetic runtime');
   writeFileSync(join(root,'.env.local'),'SYNTHETIC=private');
   writeFileSync(join(root,'private-key.pem'),'synthetic');
  }
  const resources=join(folder,'dist','resources');
  const matchers=getFileMatchers(config,'extraResources',resources,{
   macroExpander:value=>value,customBuildOptions:{},globalOutDir:join(folder,'dist'),defaultSrc:folder,
  });
  await copyFiles(matchers);
  for(const id of ['lexispredict','infinitum']){
   const root=join(resources,'products',id);
   for(const path of ['server.js','.next/BUILD_ID','node_modules/next/package.json','node_modules/next/node_modules/styled-jsx/package.json','node_modules/next/dist/server/lib/start-server.js'])
    assert.equal(existsSync(join(root,path)),true,id+': '+path);
   assert.equal(existsSync(join(root,'.env.local')),false);
   assert.equal(existsSync(join(root,'private-key.pem')),false);
  }
  assert.equal(existsSync(join(resources,'products','unapproved')),false);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
