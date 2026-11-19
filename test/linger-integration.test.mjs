import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLingerCompatibility} from '../src/linger-integration.mjs';
import {officialToolUrl} from '../src/official-tools.mjs';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const GiB=1024**3;

test('a Central não recomenda o Linger pesado num i3 com 8 GB de RAM',()=>{
 const result=evaluateLingerCompatibility({platform:'win32',arch:'x64',totalMemory:8*GiB});
 assert.equal(result.mode,'lightweight');
 assert.equal(result.canAutoInstall,false);
 assert.match(result.message,/Qwen3|8 GB/i);
});

test('Linger continua opcional mesmo em PCs mais fortes; não promete GPU por RAM',()=>{
 const medium=evaluateLingerCompatibility({platform:'win32',arch:'x64',totalMemory:16*GiB});
 const high=evaluateLingerCompatibility({platform:'win32',arch:'x64',totalMemory:64*GiB});
 assert.equal(medium.canAutoInstall,false);
 assert.equal(high.canAutoInstall,false);
 assert.equal(high.mode,'manual-gpu-review');
 assert.match(high.message,/GPU/i);
});

test('não anuncia compatibilidade sem recursos conhecidos e não ativa no Android',()=>{
 assert.equal(evaluateLingerCompatibility({platform:'android',arch:'arm64',totalMemory:16*GiB}).mode,'unsupported');
 assert.equal(evaluateLingerCompatibility({platform:'win32',arch:'x64',totalMemory:0}).mode,'unknown');
});

test('abre apenas release do editor do Linger e preserva a separação do W1',()=>{
 assert.equal(officialToolUrl('linger'),'https://github.com/simplexai-labs/linger/releases/latest');
 const main=source('src/main.mjs');
 const store=source('src/store.html');
 const ui=source('src/linger-ui.js');
 const bot=source('src/predictbot.html');
 assert.match(main,/central:linger-capability/);
 assert.match(main,/trustedStoreEvent/);
 assert.match(store,/id="setup-linger"/);
 assert.match(store,/id="linger-compatibility"/);
 assert.doesNotMatch(bot,/id="setup-linger"/);
 assert.match(store,/linger-ui\.js/);
 assert.match(bot,/predictbot-ui\.js/);
 assert.match(ui,/setup-linger/);
 assert.match(ui,/getLingerCapability/);
 assert.doesNotMatch(main,/require\(['"]linger['"]\)/);
});
