import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('instalador NSIS fecha a Central automaticamente sem pedir intervenção manual',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.build.nsis.include,'build/installer.nsh');
 const script=read('build/installer.nsh');
 assert.match(script,/!macro customCheckAppRunning/);
 assert.match(script,/Var pid/);
 assert.ok(script.indexOf("Var pid") < script.indexOf("!macro customCheckAppRunning"));
 assert.match(script,/KILL_PROCESS "\$\{APP_EXECUTABLE_FILENAME\}" 0/);
 assert.match(script,/KILL_PROCESS "\$\{APP_EXECUTABLE_FILENAME\}" 1/);
 assert.doesNotMatch(script,/MessageBox.*appRunning/i);
});

test('workflow gera cada instalador uma única vez e reutiliza win-unpacked nos testes',()=>{
 const workflow=read('.github/workflows/windows.yml');
 assert.equal((workflow.match(/npm run dist:win/g)||[]).length,1);
 assert.doesNotMatch(workflow,/npm run pack:win/);
 assert.doesNotMatch(workflow,/package-product\.mjs \$id dir/);
 assert.equal((workflow.match(/package-product\.mjs \$id nsis/g)||[]).length,1);
 assert.match(workflow,/win-unpacked\/\$name\.exe/);
 assert.match(workflow,/actions\/cache@v4/);
 assert.match(workflow,/\.next\/standalone\/server\.js/);
 assert.match(workflow,/id: next-build-cache/);
 assert.match(workflow,/steps\.next-build-cache\.outputs\.cache-hit/);
 assert.equal((workflow.match(/if: steps\.next-cache-check\.outputs\.valid != 'true'/g)||[]).length,4);
 assert.match(workflow,/needs\.inspect\.outputs\.build == 'true' && github\.event_name != 'pull_request'/);
 assert.match(workflow,/needs\.inspect\.outputs\.lexis_sha/);
 assert.match(workflow,/needs\.inspect\.outputs\.infinitum_sha/);
});
