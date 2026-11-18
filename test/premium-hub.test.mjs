import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('loja W1 tem layout de referência com navegação, busca, cards e acesso a integrações',async()=>{
 const html=read('src/store.html');
 const dom=new JSDOM(html,{runScripts:'outside-only'});
 assert.ok(dom.window.document.querySelector('.sidebar'));
 assert.ok(dom.window.document.querySelector('.insights'));
 assert.ok(dom.window.document.querySelector('.metrics'));
 assert.ok(dom.window.document.querySelector('#catalog-search'));
 assert.ok(dom.window.document.querySelector('#oc-attach'));
 assert.ok(dom.window.document.querySelector('#setup-opencode'));
 assert.ok(dom.window.document.querySelector('#setup-warp'));
 assert.ok(dom.window.document.querySelector('#opencode-form'));
 assert.ok(dom.window.document.querySelector('#update-message'));
 assert.match(html,/Todos os seus aplicativos/);
 assert.match(html,/W1 CAPITAL/);
 dom.window.close();
});
test('busca filtra aplicativos reais e área planejada sem inventar status',async()=>{
 const dom=new JSDOM(read('src/store.html'),{runScripts:'outside-only'});
 const state={apps:[{id:'lexispredict',name:'LexisPredict',subtitle:'Jurídico',description:'Prazos',status:{phase:'bundled'},download:{version:'0.1.55',phase:'available',preview:true}},{id:'infinitum',name:'INFINITUM',subtitle:'CRM',description:'Atendimentos',status:{phase:'bundled'},download:{version:'0.1.55',phase:'available',preview:true}}],release:{}};
 dom.window.w1Central={getState:async()=>state,onState:()=>{},setAutomaticUpdates:async()=>{},openOfficialTool:async()=>{}};
 dom.window.eval(read('src/store.js'));
 await new Promise(resolve=>setTimeout(resolve,10));
 const input=dom.window.document.querySelector('#catalog-search');
 input.value='Lexis';
 input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 assert.equal(dom.window.document.querySelectorAll('.product-card:not([hidden])').length,1);
 assert.ok(dom.window.document.querySelector('.coming-soon'));
 assert.equal(dom.window.document.querySelector('#installed-count').textContent,'2');
 dom.window.close();
});
test('instalação de ferramentas oficiais não usa URL arbitrária nem atalho de proteção Windows',()=>{
 const main=read('src/main.mjs');
 assert.match(main,/central:open-official-tool/);
 assert.match(read('src/preload.cjs'),/openOfficialTool/);
 assert.doesNotMatch(main,/ExecutionPolicy\s+Bypass|SmartScreen.*off/i);
});
test('anexos locais só incluem tipos permitidos e nunca são executados pelo seletor',async()=>{
 const {classifyAttachment}=await requireAttachmentPolicy();
 assert.equal(classifyAttachment('documento.pdf',2000).kind,'document');
 assert.equal(classifyAttachment('imagem.png',400).kind,'image');
 assert.equal(classifyAttachment('video.mp4',600).kind,'video');
 assert.equal(classifyAttachment('pacote.rar',1000).kind,'archive');
 assert.equal(classifyAttachment('relatorio.xlsx',1000).kind,'document');
 assert.throws(()=>classifyAttachment('script.exe',2000),/Tipo de arquivo/);
 assert.throws(()=>classifyAttachment('segredo.env',2000),/Tipo de arquivo/);
 assert.throws(()=>classifyAttachment('arquivo.zip',200_000_000),/tamanho/);
});
async function requireAttachmentPolicy(){return await import('../src/attachment-policy.mjs')}


test('modo simples configura OpenCode local sem IDs empresariais do CRM',()=>{
 const html=read('src/store.html');
 const bot=read('src/predictbot.html');
 const js=read('src/opencode-ui.js');
 const main=read('src/main.mjs');
 assert.match(html,/id="oc-simple-setup"/);
 assert.match(bot,/id="oc-simple-setup"/);
 assert.match(js,/openCode\('simpleSetup'\)|request\('simpleSetup'\)/);
 assert.match(main,/action==='simpleSetup'/);
 assert.match(main,/app\.getPath\('documents'\)/);
});
