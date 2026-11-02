const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, __DEV__: false, process: { env: {} }, URL,
    require(name) {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
  }, { filename: file });
  return exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const session = { user: { id: 'user-1' }, access_token: 'token', refresh_token: 'refresh' };

function appHarness({ stored = session, authorized = true, configured = true } = {}) {
  const slots = [], effects = [];
  let index = 0, callback, tree, removed = false;
  const refresh = [];
  const react = {
    useState(initial) {
      const key = index++;
      if (!(key in slots)) slots[key] = initial;
      return [slots[key], value => { slots[key] = value; }];
    },
    useRef(initial) {
      const key = index++;
      if (!(key in slots)) slots[key] = { current: initial };
      return slots[key];
    },
    useEffect(fn, deps) {
      const key = index++;
      const prev = slots[key];
      if (!prev || deps.some((dep, i) => dep !== prev.deps[i])) {
        effects.push(() => {
          prev?.cleanup?.();
          slots[key] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const client = { auth: {
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    startAutoRefresh() { refresh.push('start'); }, stopAutoRefresh() { refresh.push('stop'); },
  } };
  let stateListener;
  const { default: App } = load('App.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { StyleSheet: { create: x => x }, Text: 'Text', View: 'View',
      Platform: { OS: 'android' }, AppState: { currentState: 'active',
        addEventListener(_, fn) { stateListener = fn; return { remove() { removed = true; } }; },
      } },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    './src/screens/AuthScreen': { AuthScreen: 'AuthScreen' },
    './src/navigation/AppNavigator': { AppNavigator: 'AppNavigator' },
    './src/services/authService': { authService: { async isAuthorizedUser() {
      if (authorized instanceof Error) throw authorized;
      return authorized;
    } } },
    './src/lib/supabase': { supabase: configured ? client : null, isSupabaseConfigured: configured, readStoredSession: async () => stored },
    './src/services/queryCache': { clearQueryCache() {} },
    './src/theme/colors': { colors: {} },
  });
  return {
    render() { index = 0; tree = App(); while (effects.length) effects.shift()(); return tree; },
    event(event, value) { callback(event, value); },
    visible(type) { return tree.props.children.some(child => child?.type === type); },
    background() { stateListener('background'); }, refresh,
  };
}

test('persisted session opens home before SDK initialization finishes', async () => {
  const app = appHarness(); app.render(); await tick(); app.render(); await tick(); app.render();
  assert.equal(app.visible('AppNavigator'), true);
  assert.equal(app.visible('AuthScreen'), false);
});
test('token refresh does not hide the home screen', async () => {
  const app = appHarness(); app.render(); await tick(); app.render(); await tick(); app.render();
  app.event('TOKEN_REFRESHED', { ...session, access_token: 'new' }); app.render();
  assert.equal(app.visible('AppNavigator'), true);
  assert.equal(app.visible('View'), false);
});
test('authorization network error retains persisted session', async () => {
  const app = appHarness({ authorized: new Error('offline') });
  app.render(); await tick(); app.render(); await tick(); app.render();
  assert.equal(app.visible('AppNavigator'), true);
});
test('explicit authorization denial hides home, including after token refresh', async () => {
  const app = appHarness({ authorized: false });
  app.render(); await tick(); app.render(); await tick(); app.render();
  assert.equal(app.visible('AppNavigator'), false);
  assert.equal(app.visible('AuthScreen'), true);
  app.event('TOKEN_REFRESHED', session); app.render();
  assert.equal(app.visible('AppNavigator'), false);
});
test('sign out returns to login', async () => {
  const app = appHarness(); app.render(); await tick(); app.render(); await tick(); app.render();
  app.event('SIGNED_OUT', null); app.render();
  assert.equal(app.visible('AppNavigator'), false);
  assert.equal(app.visible('AuthScreen'), true);
});
test('refresh runs in foreground and pauses in background', () => {
  const app = appHarness(); app.render(); app.background();
  assert.deepEqual(app.refresh, ['start', 'stop']);
});
test('late local session read cannot override a sign-out event', async () => {
  const app = appHarness(); app.render(); app.event('SIGNED_OUT', null);
  await tick(); app.render();
  assert.equal(app.visible('AppNavigator'), false);
});

test('no persisted session shows login after SDK initialization', async () => {
  const app = appHarness({ stored: null }); app.render();
  app.event('INITIAL_SESSION', null); await tick(); app.render();
  assert.equal(app.visible('AuthScreen'), true);
  assert.equal(app.visible('AppNavigator'), false);
});

function serviceHarness(file, exportName) {
  const calls = [];
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    order(column) { calls.push(['order', column]); return this; },
    range() { return Promise.resolve({ data: [], error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
  };
  const mocks = {
    '../data/demoData': { demoPayments: [], demoBatches: [] },
    '../lib/supabase': { isSupabaseConfigured: true, supabase: { from(table) { calls.push(['from', table]); return query; } } },
    './mappers': { mapPayment: x => x, mapBatch: x => x },
    './dataEvents': { emitDataChanged() {} },
    './queryCache': { cacheReads() {} },
    './readAllRows': load('src/services/readAllRows.ts', {}),
    '../utils/dateRules': {}, './eggTypeService': {}, './smsService': {},
  };
  return { service: load(file, mocks)[exportName], calls };
}
test('customer batch query filters at the server', async () => {
  const { service, calls } = serviceHarness('src/services/batchService.ts', 'batchService');
  await service.listByCustomer('customer-1');
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'customer_id' && call[2] === 'customer-1'));
});
test('payment detail queries filter at the server', async () => {
  const { service, calls } = serviceHarness('src/services/paymentService.ts', 'paymentService');
  await service.listByBatch('batch-1');
  await service.listByCustomer('customer-1');
  await service.getById('payment-1');
  for (const [column, value] of [['batch_id', 'batch-1'], ['customer_id', 'customer-1'], ['id', 'payment-1']]) {
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === column && call[2] === value));
  }
});

test('cache shares concurrent reads and reuses successful results', async () => {
  const cache = load('src/services/queryCache.ts', {});
  let count = 0;
  const read = async () => { count++; return ['record']; };
  const first = cache.cachedRead('list', read);
  const second = cache.cachedRead('list', read);
  assert.equal(first, second);
  await first;
  await cache.cachedRead('list', read);
  assert.equal(count, 1);
});
test('invalidating during a pending read prevents it from repopulating cache', async () => {
  const cache = load('src/services/queryCache.ts', {});
  let resolveOld;
  const old = cache.cachedRead('list', () => new Promise(resolve => { resolveOld = resolve; }));
  await tick();
  cache.clearQueryCache();
  assert.equal(await cache.cachedRead('list', async () => 'new'), 'new');
  resolveOld('old'); await old;
  assert.equal(await cache.cachedRead('list', async () => 'wrong'), 'new');
});
test('failed requests are retried rather than cached', async () => {
  const cache = load('src/services/queryCache.ts', {});
  await assert.rejects(cache.cachedRead('list', async () => { throw new Error('offline'); }));
  assert.equal(await cache.cachedRead('list', async () => 'recovered'), 'recovered');
});
test('expired cache entries fetch again', async () => {
  const cache = load('src/services/queryCache.ts', {});
  await cache.cachedRead('list', async () => 'old', -1);
  assert.equal(await cache.cachedRead('list', async () => 'fresh'), 'fresh');
});
test('cache preserves service this and separates query parameters', async () => {
  const cache = load('src/services/queryCache.ts', {});
  const service = { prefix: 'value-', async get(id) { return this.prefix + id; } };
  cache.cacheReads(service, 'service', ['get']);
  assert.equal(await service.get('a'), 'value-a');
  assert.equal(await service.get('b'), 'value-b');
});

test('detail uses a known record from a fresh cached list', async () => {
  const cache = load('src/services/queryCache.ts', {});
  let detailRequests = 0;
  const service = {
    async list() { return [{ id: 'a', name: 'cached' }]; },
    async getById(id) { detailRequests++; return { id, name: 'server' }; },
  };
  cache.cacheReads(service, 'records', ['list', 'getById']);
  await service.list();
  assert.equal((await service.getById('a')).name, 'cached');
  assert.equal(detailRequests, 0);
  assert.equal((await service.getById('missing')).name, 'server');
  assert.equal(detailRequests, 1);
  cache.clearQueryCache();
  assert.equal((await service.getById('a')).name, 'server');
});


test('sign out ends only this device session', async () => {
  let options;
  const { authService } = load('src/services/authService.ts', {
    '../lib/supabase': { isSupabaseConfigured: true, supabase: { auth: {
      async signOut(value) { options = value; return { error: null }; },
    } } },
  });
  await authService.signOut();
  assert.equal(options.scope, 'local');
});
test('paginated reads include records after the first page', async () => {
  const { readAllRows } = load('src/services/readAllRows.ts', {});
  const records = Array.from({ length: 451 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await readAllRows(async (from, to) => {
    ranges.push([from,to]); return { data: records.slice(from,to+1), error: null };
  });
  assert.equal(result.length, 451);
  assert.equal(result[450].id, 450);
  assert.deepEqual(ranges, [[0,199],[200,399],[400,599]]);
});
test('a failed later page does not return an incomplete list', async () => {
  const { readAllRows } = load('src/services/readAllRows.ts', {});
  await assert.rejects(readAllRows(async (from) => from === 0
    ? { data: Array(200).fill({}), error: null }
    : { data: null, error: new Error('offline') }));
});

test('SMS grouping retains every status without making uncertain messages sendable', () => {
  const { groupSmsLogs, smsStatusLabel } = load('src/utils/smsStatus.ts', {});
  const logs = ['PENDING','FAILED','UNKNOWN','SENDING','QUEUED','SENT','DELIVERED','NEW_STATUS'].map((status, id) => ({ status, id }));
  const groups = groupSmsLogs(logs);
  assert.equal(groups.pending.length, 4);
  assert.equal(groups.queued.length, 2);
  assert.equal(groups.sent.length, 2);
  assert.equal(groups.pending[2].status, 'UNKNOWN');
  assert.equal(smsStatusLabel('UNKNOWN'), 'Gönderim sonucu belirsiz');
});
test('money parser rejects blanks and non-finite values, accepts decimal comma', () => {
  const { parseMoneyInput } = load('src/utils/money.ts', {});
  assert.equal(parseMoneyInput('12,50'), 12.5);
  assert.equal(parseMoneyInput(''), null);
  assert.equal(parseMoneyInput('Infinity'), null);
  assert.equal(parseMoneyInput('abc'), null);
});


test('release without server configuration cannot open the demo navigator', () => {
  const app = appHarness({ configured: false, stored: null });
  app.render();
  assert.equal(app.visible('AppNavigator'), false);
  assert.equal(app.visible('View'), true);
});

test('focused refresh ignores unrelated events and refreshes on foreground', () => {
  let refreshes = 0, clears = 0, dataListener, stateListener, cleanup, unsubscribed = false, removed = false;
  const { useFocusedRefresh } = load('src/hooks/useFocusedRefresh.ts', {
    react: { useCallback: fn => fn, useRef: value => ({ current: value }) },
    'react-native': { AppState: { currentState: 'active', addEventListener(_, fn) {
      stateListener = fn; return { remove() { removed = true; } };
    } } },
    '@react-navigation/native': { useFocusEffect(fn) { cleanup = fn(); } },
    '../services/dataEvents': { subscribeDataChanged(fn) { dataListener = fn; return () => { unsubscribed = true; }; } },
    '../services/queryCache': { clearQueryCache() { clears++; } },
  });
  useFocusedRefresh(() => { refreshes++; }, ['batch', 'customer']);
  assert.equal(refreshes, 1);
  dataListener('sms'); assert.equal(refreshes, 1);
  dataListener('batch'); assert.equal(refreshes, 2);
  stateListener('background'); stateListener('active');
  assert.equal(refreshes, 3); assert.equal(clears, 1);
  cleanup(); assert.equal(unsubscribed, true); assert.equal(removed, true);
});

test('batch filters combine customer, status, type and debt without mixing customers', () => {
  const { filterBatches } = load('src/utils/batchFilters.ts', {});
  const batches = [
    { id: 'a', batchNo: 'P-001', customerId: 'c1', eggTypeId: 'e1', status: 'INCUBATING', totalPrice: 100 },
    { id: 'b', batchNo: 'P-002', customerId: 'c2', eggTypeId: 'e2', status: 'RECEIVED', totalPrice: 200 },
    { id: 'c', batchNo: 'P-003', customerId: 'c1', eggTypeId: 'e2', status: 'DELIVERED', totalPrice: 50 },
  ];
  const customers = new Map([
    ['c1', { firstName: 'İsmail', lastName: 'Şen', phone: '0532 123 45 67', phoneNormalized: '+905321234567' }],
    ['c2', { firstName: 'Gönül', lastName: 'Doğru', phone: '0543 222 11 00', phoneNormalized: '+905432221100' }],
  ]);
  const types = new Map([['e1', { name: 'Tavuk' }], ['e2', { name: 'Ördek' }]]);
  const paid = new Map([['a', 100], ['b', 50], ['c', 50]]);
  const all = { query: '', customerId: '', eggTypeId: '', status: '', debtOnly: false };
  const result = (patch) => Array.from(filterBatches(batches, customers, types, paid, { ...all, ...patch }), row => row.id);
  assert.deepEqual(result({ customerId: 'c1' }), ['a','c']);
  assert.deepEqual(result({ status: 'RECEIVED' }), ['b']);
  assert.deepEqual(result({ eggTypeId: 'e2' }), ['b','c']);
  assert.deepEqual(result({ debtOnly: true }), ['b']);
  assert.deepEqual(result({ customerId: 'c2', status: 'RECEIVED', eggTypeId: 'e2', debtOnly: true, query: 'gonul' }), ['b']);
  assert.deepEqual(result({ query: 'ismail sen' }), ['a','c']);
  assert.deepEqual(result({ query: '5321234567' }), ['a','c']);
  assert.deepEqual(result({ query: 'P-003' }), ['c']);
  assert.deepEqual(result({ customerId: 'missing' }), []);
  assert.deepEqual(result({}), ['a','b','c']);
});
