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

test('IA local é instalada pelo app e exposta apenas a janelas OpenCode confiáveis',()=>{
 const main=read('src/main.mjs'),preload=read('src/preload.cjs');
 assert.match(main,/central:local-ai/);
 assert.match(main,/trustedOpenCodeEvent/);
 assert.match(main,/managedLocalAI/);
 assert.match(main,/rootDirectory:join\(process\.env\.LOCALAPPDATA/);
 assert.match(preload,/localAI:action=>ipcRenderer\.invoke/);
 assert.match(preload,/onLocalAIProgress/);
 assert.match(read('src/opencode-controller.mjs'),/localAI:input\.localAI/);
 assert.match(read('src/store.html'),/local-ai-ui\.js/);
 assert.match(read('src/predictbot.html'),/local-ai-ui\.js/);
});

test('configuração automática de OpenCode prepara o modelo local antes da conexão',()=>{
 const ui=read('src/opencode-ui.js');
 assert.ok(ui.indexOf("await bridge.localAI('prepare')")<ui.indexOf("byId('opencode-form').requestSubmit"));
});

test('PredictBot inicia a preparação local automaticamente no primeiro uso',()=>{
 assert.match(read('src/predictbot.html'),/data-auto-setup="true"/);
 assert.match(read('src/local-ai-ui.js'),/autoSetup/);
});
