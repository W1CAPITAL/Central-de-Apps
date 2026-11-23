import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { singleFlight } from '../src/product-startup.mjs';

const main = readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');
const updateCode = main.slice(main.search(/(?:async )?function checkUpdates\(/), main.indexOf('function signatureScript('));
const candidate = { version: '0.1.315', sha256: 'fixture', releaseUrl: 'https://github.com/example' };

function createCatalogHarness(overrides = {}) {
  const pending = Promise.withResolvers();
  let requests = 0;
  const state = {
    app: { isPackaged: true, getVersion: () => '0.1.290' },
    checking: false,
    updateChecks: new Map(),
    BUILD: { id: 'lexispredict', name: 'LexisPredict' },
    release: { phase: 'none' },
    verifiedAsset: null,
    downloadedInstaller: null,
    automaticUpdates: false,
    installing: false,
    handingOffUpdate: false,
    downloadPromise: null,
    fetchReleaseCatalog: () => { requests++; return pending.promise; },
    downloads: () => ({ update() {} }),
    selectProductRelease: () => candidate,
    compareVersion: () => 1,
    previousInstallAttempt: () => false,
    announce() {},
    singleFlight,
    ...overrides,
  };
  state.publicState = () => ({ release: state.release });
  const checkUpdates = runInNewContext(updateCode + '\ncheckUpdates', state);
  return { checkUpdates, finish: () => pending.resolve([]), requests: () => requests };
}

test('uma consulta manual aguarda a verificação que já roda em segundo plano', async () => {
  const { checkUpdates, finish, requests } = createCatalogHarness();
  const background = checkUpdates();
  const manual = checkUpdates();
  finish();
  const [a, b] = await Promise.all([background, manual]);
  assert.equal(requests(), 1);
  assert.equal(a.release.version, candidate.version);
  assert.equal(b.release.version, candidate.version);
});

test('consultar a mesma release preserva o download e o percentual atuais', async () => {
  const { checkUpdates, finish } = createCatalogHarness({
    release: { phase: 'downloading', version: candidate.version, percent: 62 },
    verifiedAsset: candidate,
    downloadPromise: new Promise(() => {}),
  });
  const checked = checkUpdates();
  finish();
  const { release } = await checked;
  assert.equal(release.phase, 'downloading');
  assert.equal(release.percent, 62);
});
