import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
const store=readFileSync(new URL('../src/store.js',import.meta.url),'utf8');

test('o erro do Windows ao abrir EXE independente tenta o app integrado, sem anunciar falso sucesso',()=>{
 const start=main.indexOf('async function openInstalledProduct(id)');
 const end=main.indexOf('async function installProductWithVerification(',start);
 assert.ok(start>=0&&end>start);
 const fn=main.slice(start,end);
 assert.match(fn,/shell\.openPath\(candidate\.exe\)/);
 assert.match(fn,/await openProduct\(id\)/,'se o EXE falhar, usar a cópia local integrada');
 assert.match(fn,/status\?\.phase.*running/,'a recuperação só pode afirmar sucesso se a tela abriu');
 assert.match(fn,/recovered:true/);
});

test('a loja informa ao usuário quando abriu versão integrada por falha do EXE independente',()=>{
 assert.match(store,/result\?\.recovered/);
 assert.match(store,/versão integrada/);
});
