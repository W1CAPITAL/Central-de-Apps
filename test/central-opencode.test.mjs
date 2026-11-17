import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Central usa somente repositórios W1CAPITAL e oferece OpenCode via IPC',()=>{
 const workflow=read('.github/workflows/windows.yml');assert.ok(!workflow.includes('ProjectW1SC/INFINITUM'));
 assert.match(read('src/preload.cjs'),/openCode/);
 assert.match(read('src/main.mjs'),/trustedStoreEvent/);
 assert.match(read('src/store.html'),/opencode-form/);
});
