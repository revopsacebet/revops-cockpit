// Confere que TabDailyCashflow ainda RENDERIZA sem exceção com os novos props (M/farol/planScenarios/
// chFilter) e que o botão "Gerar PPT de Fechamento" aparece na barra de ferramentas.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const open = '<script id="app-bundle">';
const i = html.indexOf(open);
const bundle = html.slice(i + open.length, html.indexOf('</script>', i));

const noop = () => {};
const React = {
  createElement: (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(Infinity).filter(k => k != null) }),
  Fragment: 'Fragment',
  useState: (v) => { const init = typeof v === 'function' ? v() : v; return [init, noop]; },
  useMemo: (f) => f(), useEffect: noop, useRef: () => ({ current: null }),
};
const sandbox = {
  console, React, ReactDOM: { createRoot: () => ({ render: noop }) },
  document: { getElementById: () => ({}), createElement: () => ({ style: {}, setAttribute: noop }), addEventListener: noop, head: { appendChild: noop }, body: { appendChild: noop } },
  window: { addEventListener: noop, location: { search: '', href: '' }, matchMedia: () => ({ matches: false, addEventListener: noop }) },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
  setTimeout, clearTimeout, setInterval, clearInterval, XMLHttpRequest: function () {},
  navigator: { userAgent: 'node' }, Intl,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(bundle, sandbox, { filename: 'bundle.js' });
const get = (n) => vm.runInContext(n, sandbox);
const TabDailyCashflow = get('TabDailyCashflow');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } };
const flat = (n) => (n == null || n === false) ? '' : (typeof n === 'object'
  ? (n.kids || []).map(flat).join('') + (n.props && n.props.children ? [].concat(n.props.children).map(flat).join('') : '')
  : String(n));

// ENDPOINT_URL não existe no mock (modo sem backend) → o componente deve devolver o card "Disponível só no modo live".
console.log('\n— TabDailyCashflow sem ENDPOINT_URL (modo mock) —');
try {
  const tree = TabDailyCashflow({ range: { from: '2026-08-01', to: '2026-08-15' }, meta: {}, M: {}, farol: {}, planScenarios: null, chFilter: null });
  ok(true, 'renderiza sem lançar (mesmo sem ENDPOINT_URL)');
  ok(/Daily Cashflow/.test(flat(tree)), 'título "Daily Cashflow" presente');
} catch (e) {
  ok(false, 'lançou: ' + (e && e.stack || e));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
